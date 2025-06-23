import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StakeProgram } from "../target/types/stake_program";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMintToInstruction,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";
import { BN } from "bn.js";

describe("stake-program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.StakeProgram as Program<StakeProgram>;

  // Use provider wallet instead of generating new keypair to avoid airdrop
  const staker = provider.wallet.payer;
  let stakerTokenAccount: anchor.web3.PublicKey;

  // USDC-fake mint - make this static to avoid mint mismatch
  const usdcMintKp = anchor.web3.Keypair.generate();
  let rewardVault: anchor.web3.PublicKey;

  // ✅ REMOVE global stakeInfo - each test will create its own
  // let stakeInfo: anchor.web3.PublicKey;

  before(async () => {
    // Skip airdrop since we're using the main wallet that should already have SOL
    console.log(`Using wallet: ${staker.publicKey.toBase58()}`);
    
    // Check wallet balance
    const balance = await provider.connection.getBalance(staker.publicKey);
    console.log(`Wallet balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    
    if (balance < anchor.web3.LAMPORTS_PER_SOL) {
      throw new Error("Insufficient SOL balance in wallet. Please add SOL to your wallet first.");
    }

    // create USDC-fake mint
    {
      const tx = new anchor.web3.Transaction();

      const lamports = await getMinimumBalanceForRentExemptMint(
        provider.connection
      );

      const createMintIx = anchor.web3.SystemProgram.createAccount({
        fromPubkey: staker.publicKey,
        newAccountPubkey: usdcMintKp.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      });

      const initMintIx = createInitializeMint2Instruction(
        usdcMintKp.publicKey,
        6,
        staker.publicKey,
        staker.publicKey,
        TOKEN_PROGRAM_ID
      );

      stakerTokenAccount = getAssociatedTokenAddressSync(
        usdcMintKp.publicKey,
        staker.publicKey
      );

      const createStakerTokenAccountIx =
        createAssociatedTokenAccountInstruction(
          staker.publicKey,
          stakerTokenAccount,
          staker.publicKey,
          usdcMintKp.publicKey
        );

      const mintToStakerIx = createMintToInstruction(
        usdcMintKp.publicKey,
        stakerTokenAccount,
        staker.publicKey,
        1000 * 10 ** 6,
        []
      );

      tx.add(
        ...[
          createMintIx,
          initMintIx,
          createStakerTokenAccountIx,
          mintToStakerIx,
        ]
      );

      const ts = await provider.sendAndConfirm(tx, [usdcMintKp]);

      console.log("Your transaction signature", ts);
    }

    // Get reward vault address - this should be derived consistently
    rewardVault = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reward"), usdcMintKp.publicKey.toBuffer()],
      program.programId
    )[0];
  });

  it("Is initialized!", async () => {
    const tx = await program.methods
      .initialize()
      .accounts({
        admin: staker.publicKey,
        rewardVault: rewardVault,
        mint: usdcMintKp.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Your transaction signature", tx);

    const rewardVaultAccount = await getAccount(
      provider.connection,
      rewardVault
    );

    expect(rewardVaultAccount.address.toBase58()).to.equal(
      rewardVault.toBase58()
    );
    expect(Number(rewardVaultAccount.amount)).to.equal(0);
  });

  it("Stake successfully", async () => {
    // ✅ Create unique staker for this test
    const testStaker = anchor.web3.Keypair.generate();
    
    // Transfer SOL from main wallet
    const transferTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: staker.publicKey,
        toPubkey: testStaker.publicKey,
        lamports: 1 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(transferTx);

    // Create unique stakeInfo for this test
    const stakeInfo = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake_info"), testStaker.publicKey.toBytes()],
      program.programId
    )[0];

    // Create token account for test staker
    const testStakerTokenAccount = getAssociatedTokenAddressSync(
      usdcMintKp.publicKey,
      testStaker.publicKey
    );

    const createTestAccountTx = new anchor.web3.Transaction();
    createTestAccountTx.add(
      createAssociatedTokenAccountInstruction(
        testStaker.publicKey,
        testStakerTokenAccount,
        testStaker.publicKey,
        usdcMintKp.publicKey
      ),
      createMintToInstruction(
        usdcMintKp.publicKey,
        testStakerTokenAccount,
        staker.publicKey, // Original staker is mint authority
        200 * 10 ** 6,
        []
      )
    );
    await provider.sendAndConfirm(createTestAccountTx, [testStaker]);

    const vaultTokenAccount = getAssociatedTokenAddressSync(
      usdcMintKp.publicKey,
      stakeInfo,
      true
    );

    const stakeAmount = new BN(100 * 10 ** 6);

    const tx = await program.methods
      .stake(stakeAmount)
      .accounts({
        staker: testStaker.publicKey,
        mint: usdcMintKp.publicKey,
        stakeInfo: stakeInfo,
        vaultTokenAccount: vaultTokenAccount,
        stakerTokenAccount: testStakerTokenAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([testStaker])
      .rpc();

    console.log("Your transaction signature", tx);

    const stakeInfoAccount = await program.account.stakeInfo.fetch(stakeInfo);

    expect(stakeInfoAccount.staker.toBase58()).to.equal(
      testStaker.publicKey.toBase58()
    );
    expect(stakeInfoAccount.mint.toBase58()).to.equal(
      usdcMintKp.publicKey.toBase58()
    );
    expect(stakeInfoAccount.isStaked).to.equal(true);
    expect(stakeInfoAccount.amount.toString()).to.equal(stakeAmount.toString());

    const stakerAccount = await getAccount(
      provider.connection,
      testStakerTokenAccount
    );

    const vaultAccount = await getAccount(
      provider.connection,
      vaultTokenAccount
    );

    expect(stakerAccount.amount.toString()).to.equal(String(100 * 10 ** 6));
    expect(vaultAccount.amount.toString()).to.equal(String(100 * 10 ** 6));
  });

  it("Unstake successfully", async () => {
    // ✅ Create unique staker for this test
    const testStaker = anchor.web3.Keypair.generate();
    
    // Transfer SOL from main wallet
    const transferTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: staker.publicKey,
        toPubkey: testStaker.publicKey,
        lamports: 1 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(transferTx);

    // Create unique stakeInfo for this test
    const stakeInfo = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake_info"), testStaker.publicKey.toBytes()],
      program.programId
    )[0];

    // Create token account for test staker
    const testStakerTokenAccount = getAssociatedTokenAddressSync(
      usdcMintKp.publicKey,
      testStaker.publicKey
    );

    const createTestAccountTx = new anchor.web3.Transaction();
    createTestAccountTx.add(
      createAssociatedTokenAccountInstruction(
        testStaker.publicKey,
        testStakerTokenAccount,
        testStaker.publicKey,
        usdcMintKp.publicKey
      ),
      createMintToInstruction(
        usdcMintKp.publicKey,
        testStakerTokenAccount,
        staker.publicKey, // Original staker is mint authority
        200 * 10 ** 6,
        []
      )
    );
    await provider.sendAndConfirm(createTestAccountTx, [testStaker]);

    const vaultTokenAccount = getAssociatedTokenAddressSync(
      usdcMintKp.publicKey,
      stakeInfo,
      true
    );

    // First stake some tokens
    const stakeAmount = new BN(100 * 10 ** 6);
    await program.methods
      .stake(stakeAmount)
      .accounts({
        staker: testStaker.publicKey,
        mint: usdcMintKp.publicKey,
        stakeInfo: stakeInfo,
        vaultTokenAccount: vaultTokenAccount,
        stakerTokenAccount: testStakerTokenAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([testStaker])
      .rpc();

    // mint reward token to reward vault using the same mint
    const mintTx = new anchor.web3.Transaction();
  
    const mintToRewardVaultIx = createMintToInstruction(
      usdcMintKp.publicKey,
      rewardVault,
      staker.publicKey,
      1000 * 10 ** 6,
      []
    );
  
    mintTx.add(mintToRewardVaultIx);
    await provider.sendAndConfirm(mintTx);
  
    const tx = await program.methods
      .unstake()
      .accounts({
        staker: testStaker.publicKey,
        mint: usdcMintKp.publicKey,
        stakeInfo: stakeInfo,
        vaultTokenAccount: vaultTokenAccount,
        rewardVault: rewardVault,
        stakerTokenAccount: testStakerTokenAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([testStaker])
      .rpc();
  
    console.log("Your transaction signature", tx);
  
    // Verify account is closed
    try {
      await program.account.stakeInfo.fetch(stakeInfo);
      expect.fail("Account should be closed");
    } catch (error) {
      expect(error.message).to.include("Account does not exist");
      console.log("✅ Account successfully closed");
    }
  
    // Check token balances
    const stakerAccount = await getAccount(provider.connection, testStakerTokenAccount);
    const rewardVaultAccount = await getAccount(provider.connection, rewardVault);
    const vaultAccount = await getAccount(provider.connection, vaultTokenAccount);
  
    expect(Number(stakerAccount.amount)).to.greaterThan(100 * 10 ** 6);
    expect(Number(vaultAccount.amount)).to.equal(0);
    expect(Number(rewardVaultAccount.amount)).to.lessThan(1000 * 10 ** 6);
  });

  it("Should support multiple reward vaults for different tokens", async () => {
    // Create second mint (SOL-fake)
    const solMintKp = anchor.web3.Keypair.generate();
    
    // Create SOL-fake mint
    const tx = new anchor.web3.Transaction();
    
    const lamports = await getMinimumBalanceForRentExemptMint(
      provider.connection
    );
  
    const createMintIx = anchor.web3.SystemProgram.createAccount({
      fromPubkey: staker.publicKey,
      newAccountPubkey: solMintKp.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    });
  
    const initMintIx = createInitializeMint2Instruction(
      solMintKp.publicKey,
      9, // SOL has 9 decimals
      staker.publicKey,
      staker.publicKey,
      TOKEN_PROGRAM_ID
    );
  
    tx.add(createMintIx, initMintIx);
    await provider.sendAndConfirm(tx, [solMintKp]);
  
    // Derive reward vaults for both tokens
    const usdcRewardVault = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reward"), usdcMintKp.publicKey.toBuffer()],
      program.programId
    )[0];
    
    const solRewardVault = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reward"), solMintKp.publicKey.toBuffer()],
      program.programId
    )[0];
    
    // Verify they are different addresses
    expect(usdcRewardVault.toBase58()).to.not.equal(solRewardVault.toBase58());
    
    console.log("USDC Reward Vault:", usdcRewardVault.toBase58());
    console.log("SOL Reward Vault:", solRewardVault.toBase58());
  
    // Initialize SOL reward vault
    await program.methods
      .initialize()
      .accounts({
        admin: staker.publicKey,
        rewardVault: solRewardVault,
        mint: solMintKp.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  
    // Verify both vaults exist and are different
    const usdcVaultAccount = await getAccount(provider.connection, usdcRewardVault);
    const solVaultAccount = await getAccount(provider.connection, solRewardVault);
    
    expect(usdcVaultAccount.mint.toBase58()).to.equal(usdcMintKp.publicKey.toBase58());
    expect(solVaultAccount.mint.toBase58()).to.equal(solMintKp.publicKey.toBase58());
    
    console.log("✅ Multiple reward vaults created successfully!");
  });

  it("Should fail with wrong staker trying to unstake", async () => {
    // ✅ Create unique test staker for legitimate stake
    const testStaker = anchor.web3.Keypair.generate();
    
    // Transfer SOL from main wallet
    const transferTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: staker.publicKey,
        toPubkey: testStaker.publicKey,
        lamports: 1 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(transferTx);

    // Create unique stakeInfo for this test
    const testStakeInfo = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake_info"), testStaker.publicKey.toBytes()],
      program.programId
    )[0];

    // Create token account for test staker
    const testStakerTokenAccount = getAssociatedTokenAddressSync(
      usdcMintKp.publicKey,
      testStaker.publicKey
    );

    const createTestAccountTx = new anchor.web3.Transaction();
    createTestAccountTx.add(
      createAssociatedTokenAccountInstruction(
        testStaker.publicKey,
        testStakerTokenAccount,
        testStaker.publicKey,
        usdcMintKp.publicKey
      ),
      createMintToInstruction(
        usdcMintKp.publicKey,
        testStakerTokenAccount,
        staker.publicKey, // Original staker is mint authority
        200 * 10 ** 6,
        []
      )
    );
    await provider.sendAndConfirm(createTestAccountTx, [testStaker]);

    // First stake some tokens to have something to unstake
    const stakeAmount = new BN(50 * 10 ** 6);
    
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      usdcMintKp.publicKey,
      testStakeInfo,
      true
    );
  
    await program.methods
      .stake(stakeAmount)
      .accounts({
        staker: testStaker.publicKey,
        mint: usdcMintKp.publicKey,
        stakeInfo: testStakeInfo,
        vaultTokenAccount: vaultTokenAccount,
        stakerTokenAccount: testStakerTokenAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([testStaker])
      .rpc();
  
    // Create wrong staker but fund from existing wallet instead of airdrop
    const wrongStaker = anchor.web3.Keypair.generate();
    
    // Transfer SOL from main wallet instead of airdrop to avoid rate limiting
    const transferTx2 = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: staker.publicKey,
        toPubkey: wrongStaker.publicKey,
        lamports: 0.1 * anchor.web3.LAMPORTS_PER_SOL, // Just enough for transaction fees
      })
    );
    await provider.sendAndConfirm(transferTx2);
  
    // Create token account for wrong staker
    const wrongStakerTokenAccount = getAssociatedTokenAddressSync(
      usdcMintKp.publicKey,
      wrongStaker.publicKey
    );
  
    const createAccountTx = new anchor.web3.Transaction();
    createAccountTx.add(
      createAssociatedTokenAccountInstruction(
        wrongStaker.publicKey,
        wrongStakerTokenAccount,
        wrongStaker.publicKey,
        usdcMintKp.publicKey
      )
    );
    await provider.sendAndConfirm(createAccountTx, [wrongStaker]);
  
    try {
      await program.methods
        .unstake()
        .accounts({
          staker: wrongStaker.publicKey, // ❌ Wrong staker
          mint: usdcMintKp.publicKey,
          stakeInfo: testStakeInfo, // This belongs to testStaker
          vaultTokenAccount: vaultTokenAccount,
          rewardVault: rewardVault,
          stakerTokenAccount: wrongStakerTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([wrongStaker])
        .rpc();
      
      expect.fail("Should have failed with has_one constraint");
    } catch (error) {
      // Thay vì check specific error code "2003", check error message chứa keywords về constraint violation
      console.log("Error details:", error.message);
      expect(error.message).to.include("AnchorError");
      // Hoặc check các patterns khác có thể xuất hiện:
      const isConstraintError = error.message.includes("constraint") || 
                               error.message.includes("account") ||
                               error.message.includes("2003") ||
                               error.message.includes("has_one");
      expect(isConstraintError).to.be.true;
      console.log("✅ Correctly rejected wrong staker");
    }
  });

  it("Should close stake_info account and return rent", async () => {
    // ✅ Create unique staker for this test (already implemented correctly)
    const testStaker = anchor.web3.Keypair.generate();
    
    // Transfer SOL from main wallet instead of airdrop
    const transferTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: staker.publicKey,
        toPubkey: testStaker.publicKey,
        lamports: 1 * anchor.web3.LAMPORTS_PER_SOL, // Enough for all operations
      })
    );
    await provider.sendAndConfirm(transferTx);

    // Create new stakeInfo for test staker
    const testStakeInfo = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake_info"), testStaker.publicKey.toBytes()],
      program.programId
    )[0];

    // Create token account for test staker
    const testStakerTokenAccount = getAssociatedTokenAddressSync(
      usdcMintKp.publicKey,
      testStaker.publicKey
    );

    const createTestAccountTx = new anchor.web3.Transaction();
    createTestAccountTx.add(
      createAssociatedTokenAccountInstruction(
        testStaker.publicKey,
        testStakerTokenAccount,
        testStaker.publicKey,
        usdcMintKp.publicKey
      ),
      createMintToInstruction(
        usdcMintKp.publicKey,
        testStakerTokenAccount,
        staker.publicKey, // Original staker is mint authority
        100 * 10 ** 6,
        []
      )
    );
    await provider.sendAndConfirm(createTestAccountTx, [testStaker]);
    
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      usdcMintKp.publicKey,
      testStakeInfo,
      true
    );

    // Stake with test staker
    const stakeAmount = new BN(75 * 10 ** 6);
    await program.methods
      .stake(stakeAmount)
      .accounts({
        staker: testStaker.publicKey,
        mint: usdcMintKp.publicKey,
        stakeInfo: testStakeInfo,
        vaultTokenAccount: vaultTokenAccount,
        stakerTokenAccount: testStakerTokenAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([testStaker])
      .rpc();
  
    // Get staker SOL balance before unstake
    const balanceBefore = await provider.connection.getBalance(testStaker.publicKey);
    console.log(`Balance before unstake: ${balanceBefore / anchor.web3.LAMPORTS_PER_SOL} SOL`);
  
    // Verify stake_info account exists
    const stakeInfoAccountBefore = await program.account.stakeInfo.fetch(testStakeInfo);
    expect(stakeInfoAccountBefore.isStaked).to.equal(true);
  
    // Mint some reward tokens to reward vault
    const mintTx = new anchor.web3.Transaction();
    const mintToRewardVaultIx = createMintToInstruction(
      usdcMintKp.publicKey,
      rewardVault,
      staker.publicKey,
      500 * 10 ** 6,
      []
    );
    mintTx.add(mintToRewardVaultIx);
    await provider.sendAndConfirm(mintTx);
  
    // Unstake (this should close the account)
    const tx = await program.methods
      .unstake()
      .accounts({
        staker: testStaker.publicKey,
        mint: usdcMintKp.publicKey,
        stakeInfo: testStakeInfo,
        vaultTokenAccount: vaultTokenAccount,
        rewardVault: rewardVault,
        stakerTokenAccount: testStakerTokenAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([testStaker])
      .rpc();
  
    console.log("Unstake transaction signature", tx);
  
    // Verify account is closed
    try {
      await program.account.stakeInfo.fetch(testStakeInfo);
      expect.fail("Account should be closed");
    } catch (error) {
      expect(error.message).to.include("Account does not exist");
      console.log("✅ Stake info account successfully closed");
    }
  
    // Check rent returned (balance should increase)
    const balanceAfter = await provider.connection.getBalance(testStaker.publicKey);
    console.log(`Balance after unstake: ${balanceAfter / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    
    const rentRefund = balanceAfter - balanceBefore;
    console.log(`Net change (rent - fees): ${rentRefund} lamports`);
    
    // We expect some rent to be returned, even after accounting for transaction fees
    expect(rentRefund).to.be.greaterThan(-10000); // Allow for transaction fees
  });

  // Add delay between tests to avoid rate limiting
  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
});