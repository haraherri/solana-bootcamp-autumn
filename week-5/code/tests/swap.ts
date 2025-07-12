import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Amm } from "../target/types/amm";
import { assert } from "chai";
import {
  ASSOCIATED_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@coral-xyz/anchor/dist/cjs/utils/token";
import { mintToken } from "./utils";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BN } from "bn.js";

// @ts-ignore
BN.prototype.sqrt = function sqrt() {
  var z = new BN(0);
  if (this.gt(new BN(3))) {
    z = this;
    var x = this.div(new BN(2)).add(new BN(1));
    while (x.lt(z)) {
      z = x;
      x = this.div(x).add(x).div(new BN(2));
    }
  } else if (!this.eq(new BN(0))) {
    z = new BN(1);
  }
  return z;
};

describe("swap", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Amm as Program<Amm>;

  const trader = anchor.web3.Keypair.generate();
  const depositor = anchor.web3.Keypair.generate();
  
  // Add randomness to avoid conflicts
  const randomSeed = Math.floor(Math.random() * 1000000);
  let id: anchor.web3.PublicKey;
  let fee = 300; // 3% fee (300 basis points)

  let ammPda: anchor.web3.PublicKey;

  let mintAKp: anchor.web3.Keypair;
  const mintADecimals = 6;
  let mintBKp: anchor.web3.Keypair;
  const mintBDecimals = 6;

  let poolPda: anchor.web3.PublicKey;
  let poolAuthorityPda: anchor.web3.PublicKey;

  let mintLiquidityPda: anchor.web3.PublicKey;

  let poolAccountA: anchor.web3.PublicKey;
  let poolAccountB: anchor.web3.PublicKey;

  let traderAccountA: anchor.web3.PublicKey;
  let traderAccountB: anchor.web3.PublicKey;

  let depositorAccountA: anchor.web3.PublicKey;
  let depositorAccountB: anchor.web3.PublicKey;
  let depositorLPAccount: anchor.web3.PublicKey;

  before(async () => {
    // Add delay to ensure proper cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Airdrop SOL to trader and depositor
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        trader.publicKey,
        anchor.web3.LAMPORTS_PER_SOL * 3
      )
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        depositor.publicKey,
        anchor.web3.LAMPORTS_PER_SOL * 3
      )
    );

    // Create unique ID with randomness
    id = anchor.web3.Keypair.generate().publicKey;

    ammPda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("amm"), id.toBuffer()],
      program.programId
    )[0];

    console.log("Using AMM PDA:", ammPda.toBase58());
    console.log("Using random seed:", randomSeed);

    // Create AMM
    const createAmmTx = await program.methods
      .createAmm(id, fee)
      .accounts({
        amm: ammPda,
        admin: provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Create AMM success signature", createAmmTx);

    // Create fresh mints for each test run
    mintAKp = anchor.web3.Keypair.generate();
    mintBKp = anchor.web3.Keypair.generate();

    console.log("Mint A:", mintAKp.publicKey.toBase58());
    console.log("Mint B:", mintBKp.publicKey.toBase58());

    // Mint tokens to depositor for initial liquidity
    await mintToken({
      connection: provider.connection,
      payer: depositor,
      receiver: depositor.publicKey,
      mint: mintAKp,
      decimals: mintADecimals,
      amount: 10000,
    });

    await mintToken({
      connection: provider.connection,
      payer: depositor,
      receiver: depositor.publicKey,
      mint: mintBKp,
      decimals: mintBDecimals,
      amount: 20000,
    });

    // Since depositor is the mint authority, use depositor to mint tokens for trader
    await mintToken({
      connection: provider.connection,
      payer: depositor, // Use depositor as payer since it's the mint authority
      receiver: trader.publicKey, // But mint to trader's account
      mint: mintAKp,
      decimals: mintADecimals,
      amount: 5000,
    });

    await mintToken({
      connection: provider.connection,
      payer: depositor, // Use depositor as payer since it's the mint authority
      receiver: trader.publicKey, // But mint to trader's account
      mint: mintBKp,
      decimals: mintBDecimals,
      amount: 5000,
    });

    // Setup PDAs
    poolPda = anchor.web3.PublicKey.findProgramAddressSync(
      [
        ammPda.toBuffer(),
        mintAKp.publicKey.toBuffer(),
        mintBKp.publicKey.toBuffer(),
      ],
      program.programId
    )[0];

    poolAuthorityPda = anchor.web3.PublicKey.findProgramAddressSync(
      [
        ammPda.toBuffer(),
        mintAKp.publicKey.toBuffer(),
        mintBKp.publicKey.toBuffer(),
        Buffer.from("authority"),
      ],
      program.programId
    )[0];

    mintLiquidityPda = anchor.web3.PublicKey.findProgramAddressSync(
      [
        ammPda.toBuffer(),
        mintAKp.publicKey.toBuffer(),
        mintBKp.publicKey.toBuffer(),
        Buffer.from("mint_liquidity"),
      ],
      program.programId
    )[0];

    poolAccountA = getAssociatedTokenAddressSync(
      mintAKp.publicKey,
      poolAuthorityPda,
      true
    );

    poolAccountB = getAssociatedTokenAddressSync(
      mintBKp.publicKey,
      poolAuthorityPda,
      true
    );

    console.log("Pool PDA:", poolPda.toBase58());
    console.log("Pool Authority PDA:", poolAuthorityPda.toBase58());

    // Create pool
    const createPoolTx = await program.methods
      .createPool()
      .accounts({
        pool: poolPda,
        poolAuthority: poolAuthorityPda,
        mintLiquidity: mintLiquidityPda,
        amm: ammPda,
        mintA: mintAKp.publicKey,
        mintB: mintBKp.publicKey,
        poolAccountA: poolAccountA,
        poolAccountB: poolAccountB,
        payer: provider.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Create pool success signature", createPoolTx);

    // Setup accounts
    depositorAccountA = getAssociatedTokenAddressSync(
      mintAKp.publicKey,
      depositor.publicKey,
      false
    );

    depositorAccountB = getAssociatedTokenAddressSync(
      mintBKp.publicKey,
      depositor.publicKey,
      false
    );

    depositorLPAccount = getAssociatedTokenAddressSync(
      mintLiquidityPda,
      depositor.publicKey,
      true
    );

    traderAccountA = getAssociatedTokenAddressSync(
      mintAKp.publicKey,
      trader.publicKey,
      false
    );

    traderAccountB = getAssociatedTokenAddressSync(
      mintBKp.publicKey,
      trader.publicKey,
      false
    );

    // Initial deposit to create liquidity
    const amountA = new BN(1000 * 10 ** mintADecimals);
    const amountB = new BN(2000 * 10 ** mintBDecimals);

    await program.methods
      .depositLiquidity(amountA, amountB)
      .accounts({
        pool: poolPda,
        poolAuthority: poolAuthorityPda,
        mintLiquidity: mintLiquidityPda,
        mintA: mintAKp.publicKey,
        mintB: mintBKp.publicKey,
        poolAccountA: poolAccountA,
        poolAccountB: poolAccountB,
        depositorAccountLiquidity: depositorLPAccount,
        depositorAccountA: depositorAccountA,
        depositorAccountB: depositorAccountB,
        depositor: depositor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      })
      .signers([depositor])
      .rpc();

    console.log("Initial deposit completed - Pool A: 1000, Pool B: 2000");
  });


  it("swap A -> B", async () => {
    // Get initial balances
    const initialTraderA = await getAccount(provider.connection, traderAccountA);
    const initialTraderB = await getAccount(provider.connection, traderAccountB);
    const initialPoolA = await getAccount(provider.connection, poolAccountA);
    const initialPoolB = await getAccount(provider.connection, poolAccountB);

    console.log("Initial Trader A balance:", initialTraderA.amount.toString());
    console.log("Initial Trader B balance:", initialTraderB.amount.toString());
    console.log("Initial Pool A balance:", initialPoolA.amount.toString());
    console.log("Initial Pool B balance:", initialPoolB.amount.toString());

    // Swap 100 Token A -> Token B
    const inputAmount = new BN(100 * 10 ** mintADecimals);
    const minOutputAmount = new BN(0); // No slippage protection for test

    // Calculate expected output: amount_out = (y * amount_in * (10000 - fee)) / (x * 10000 + amount_in * (10000 - fee))
    const fee_multiplier = 10000 - fee; // 10000 - 300 = 9700
    const inputWithFee = inputAmount.mul(new BN(fee_multiplier)).div(new BN(10000));
    const numerator = new BN(initialPoolB.amount.toString()).mul(inputWithFee);
    const denominator = new BN(initialPoolA.amount.toString()).mul(new BN(10000)).add(inputWithFee.mul(new BN(10000)));
    const expectedOutput = numerator.div(denominator);

    console.log("Expected output:", expectedOutput.toString());

    const tx = await program.methods
      .swap(true, inputAmount, minOutputAmount) // true = A -> B
      .accounts({
        amm: ammPda,
        pool: poolPda,
        poolAuthority: poolAuthorityPda,
        mintA: mintAKp.publicKey,
        mintB: mintBKp.publicKey,
        poolAccountA: poolAccountA,
        poolAccountB: poolAccountB,
        traderAccountA: traderAccountA,
        traderAccountB: traderAccountB,
        trader: trader.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      })
      .signers([trader])
      .rpc();

    console.log("Swap A -> B success signature", tx);

    // Get final balances
    const finalTraderA = await getAccount(provider.connection, traderAccountA);
    const finalTraderB = await getAccount(provider.connection, traderAccountB);
    const finalPoolA = await getAccount(provider.connection, poolAccountA);
    const finalPoolB = await getAccount(provider.connection, poolAccountB);

    console.log("Final Trader A balance:", finalTraderA.amount.toString());
    console.log("Final Trader B balance:", finalTraderB.amount.toString());
    console.log("Final Pool A balance:", finalPoolA.amount.toString());
    console.log("Final Pool B balance:", finalPoolB.amount.toString());

    // Calculate actual output
    const actualOutput = new BN(finalTraderB.amount.toString()).sub(new BN(initialTraderB.amount.toString()));
    console.log("Actual output:", actualOutput.toString());

    // Assertions
    assert(finalTraderA.amount < initialTraderA.amount, "Trader A balance should decrease");
    assert(finalTraderB.amount > initialTraderB.amount, "Trader B balance should increase");
    assert(finalPoolA.amount > initialPoolA.amount, "Pool A balance should increase");
    assert(finalPoolB.amount < initialPoolB.amount, "Pool B balance should decrease");

    // Verify constant product formula (with some tolerance for rounding)
    const kBefore = new BN(initialPoolA.amount.toString()).mul(new BN(initialPoolB.amount.toString()));
    const kAfter = new BN(finalPoolA.amount.toString()).mul(new BN(finalPoolB.amount.toString()));
    console.log("K before:", kBefore.toString());
    console.log("K after:", kAfter.toString());
    assert(kAfter.gte(kBefore), "Constant product should be maintained or increased");
  });

  it("swap B -> A", async () => {
    // Get initial balances
    const initialTraderA = await getAccount(provider.connection, traderAccountA);
    const initialTraderB = await getAccount(provider.connection, traderAccountB);
    const initialPoolA = await getAccount(provider.connection, poolAccountA);
    const initialPoolB = await getAccount(provider.connection, poolAccountB);

    console.log("Initial Trader A balance:", initialTraderA.amount.toString());
    console.log("Initial Trader B balance:", initialTraderB.amount.toString());
    console.log("Initial Pool A balance:", initialPoolA.amount.toString());
    console.log("Initial Pool B balance:", initialPoolB.amount.toString());

    // Swap 200 Token B -> Token A
    const inputAmount = new BN(200 * 10 ** mintBDecimals);
    const minOutputAmount = new BN(0); // No slippage protection for test

    const tx = await program.methods
      .swap(false, inputAmount, minOutputAmount) // false = B -> A
      .accounts({
        amm: ammPda,
        pool: poolPda,
        poolAuthority: poolAuthorityPda,
        mintA: mintAKp.publicKey,
        mintB: mintBKp.publicKey,
        poolAccountA: poolAccountA,
        poolAccountB: poolAccountB,
        traderAccountA: traderAccountA,
        traderAccountB: traderAccountB,
        trader: trader.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      })
      .signers([trader])
      .rpc();

    console.log("Swap B -> A success signature", tx);

    // Get final balances
    const finalTraderA = await getAccount(provider.connection, traderAccountA);
    const finalTraderB = await getAccount(provider.connection, traderAccountB);
    const finalPoolA = await getAccount(provider.connection, poolAccountA);
    const finalPoolB = await getAccount(provider.connection, poolAccountB);

    console.log("Final Trader A balance:", finalTraderA.amount.toString());
    console.log("Final Trader B balance:", finalTraderB.amount.toString());
    console.log("Final Pool A balance:", finalPoolA.amount.toString());
    console.log("Final Pool B balance:", finalPoolB.amount.toString());

    // Calculate actual output
    const actualOutput = new BN(finalTraderA.amount.toString()).sub(new BN(initialTraderA.amount.toString()));
    console.log("Actual output:", actualOutput.toString());

    // Assertions
    assert(finalTraderA.amount > initialTraderA.amount, "Trader A balance should increase");
    assert(finalTraderB.amount < initialTraderB.amount, "Trader B balance should decrease");
    assert(finalPoolA.amount < initialPoolA.amount, "Pool A balance should decrease");
    assert(finalPoolB.amount > initialPoolB.amount, "Pool B balance should increase");

    // Verify constant product formula
    const kBefore = new BN(initialPoolA.amount.toString()).mul(new BN(initialPoolB.amount.toString()));
    const kAfter = new BN(finalPoolA.amount.toString()).mul(new BN(finalPoolB.amount.toString()));
    console.log("K before:", kBefore.toString());
    console.log("K after:", kAfter.toString());
    assert(kAfter.gte(kBefore), "Constant product should be maintained or increased");
  });

  it("swap with slippage protection", async () => {
    // Try to swap with min_output_amount higher than possible
    const inputAmount = new BN(50 * 10 ** mintADecimals);
    const minOutputAmount = new BN(1000 * 10 ** mintBDecimals); // Unrealistically high

    try {
      await program.methods
        .swap(true, inputAmount, minOutputAmount)
        .accounts({
          amm: ammPda,
          pool: poolPda,
          poolAuthority: poolAuthorityPda,
          mintA: mintAKp.publicKey,
          mintB: mintBKp.publicKey,
          poolAccountA: poolAccountA,
          poolAccountB: poolAccountB,
          traderAccountA: traderAccountA,
          traderAccountB: traderAccountB,
          trader: trader.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        })
        .signers([trader])
        .rpc();

      assert.fail("Should have failed due to slippage protection");
    } catch (error) {
      console.log("Slippage protection worked - transaction failed as expected");
      assert(error.toString().includes("OutputTooSmall"), "Should fail with OutputTooSmall error");
    }
  });
});