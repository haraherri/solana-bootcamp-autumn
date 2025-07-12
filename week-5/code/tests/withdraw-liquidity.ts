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

describe("withdraw-liquidity", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Amm as Program<Amm>;

  const depositor = anchor.web3.Keypair.generate();
  let id: anchor.web3.PublicKey;
  let fee = 100;

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

  let depositorMintAAccount: anchor.web3.PublicKey;
  let depositorMintBAccount: anchor.web3.PublicKey;
  let depositorLPAccount: anchor.web3.PublicKey;

  before(async () => {
    // Airdrop SOL to depositor
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        depositor.publicKey,
        anchor.web3.LAMPORTS_PER_SOL * 3
      )
    );

    id = anchor.web3.Keypair.generate().publicKey;

    ammPda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("amm"), id.toBuffer()],
      program.programId
    )[0];

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

    // Create mints and mint tokens
    mintAKp = anchor.web3.Keypair.generate();
    mintBKp = anchor.web3.Keypair.generate();

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

    // Setup user accounts
    depositorLPAccount = getAssociatedTokenAddressSync(
      mintLiquidityPda,
      depositor.publicKey,
      true
    );

    depositorMintAAccount = getAssociatedTokenAddressSync(
      mintAKp.publicKey,
      depositor.publicKey,
      false
    );

    depositorMintBAccount = getAssociatedTokenAddressSync(
      mintBKp.publicKey,
      depositor.publicKey,
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
        depositorAccountA: depositorMintAAccount,
        depositorAccountB: depositorMintBAccount,
        depositor: depositor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      })
      .signers([depositor])
      .rpc();

    console.log("Initial deposit completed");
  });

  it("withdraw-liquidity - partial withdrawal", async () => {
    // Get initial balances
    const initialUserA = await getAccount(provider.connection, depositorMintAAccount);
    const initialUserB = await getAccount(provider.connection, depositorMintBAccount);
    const initialUserLP = await getAccount(provider.connection, depositorLPAccount);
    const initialPoolA = await getAccount(provider.connection, poolAccountA);
    const initialPoolB = await getAccount(provider.connection, poolAccountB);

    console.log("Initial User LP balance:", initialUserLP.amount.toString());
    console.log("Initial Pool A balance:", initialPoolA.amount.toString());
    console.log("Initial Pool B balance:", initialPoolB.amount.toString());

    // Withdraw 50% of LP tokens
    const withdrawAmount = new BN(initialUserLP.amount.toString()).div(new BN(2));

    const tx = await program.methods
      .withdrawLiquidity(withdrawAmount)
      .accounts({
        pool: poolPda,
        poolAuthority: poolAuthorityPda,
        mintLiquidity: mintLiquidityPda,
        mintA: mintAKp.publicKey,
        mintB: mintBKp.publicKey,
        poolAccountA: poolAccountA,
        poolAccountB: poolAccountB,
        depositorAccountLiquidity: depositorLPAccount,
        depositorAccountA: depositorMintAAccount,
        depositorAccountB: depositorMintBAccount,
        depositor: depositor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      })
      .signers([depositor])
      .rpc();

    console.log("Withdraw liquidity success signature", tx);

    // Get final balances
    const finalUserA = await getAccount(provider.connection, depositorMintAAccount);
    const finalUserB = await getAccount(provider.connection, depositorMintBAccount);
    const finalUserLP = await getAccount(provider.connection, depositorLPAccount);
    const finalPoolA = await getAccount(provider.connection, poolAccountA);
    const finalPoolB = await getAccount(provider.connection, poolAccountB);

    console.log("Final User LP balance:", finalUserLP.amount.toString());
    console.log("Final Pool A balance:", finalPoolA.amount.toString());
    console.log("Final Pool B balance:", finalPoolB.amount.toString());

    // Validate results
    const expectedTokenAWithdrawn = new BN(initialPoolA.amount.toString()).mul(withdrawAmount).div(new BN(initialUserLP.amount.toString()));
    const expectedTokenBWithdrawn = new BN(initialPoolB.amount.toString()).mul(withdrawAmount).div(new BN(initialUserLP.amount.toString()));

    const actualTokenAWithdrawn = new BN(finalUserA.amount.toString()).sub(new BN(initialUserA.amount.toString()));
    const actualTokenBWithdrawn = new BN(finalUserB.amount.toString()).sub(new BN(initialUserB.amount.toString()));

    console.log("Expected Token A withdrawn:", expectedTokenAWithdrawn.toString());
    console.log("Actual Token A withdrawn:", actualTokenAWithdrawn.toString());
    console.log("Expected Token B withdrawn:", expectedTokenBWithdrawn.toString());
    console.log("Actual Token B withdrawn:", actualTokenBWithdrawn.toString());

    // Assertions
    assert(finalUserLP.amount < initialUserLP.amount, "LP tokens should be burned");
    assert(finalUserA.amount > initialUserA.amount, "User should receive token A");
    assert(finalUserB.amount > initialUserB.amount, "User should receive token B");
    assert(finalPoolA.amount < initialPoolA.amount, "Pool A should decrease");
    assert(finalPoolB.amount < initialPoolB.amount, "Pool B should decrease");
  });

  it("withdraw-liquidity - full withdrawal", async () => {
    // Get current balances
    const currentUserLP = await getAccount(provider.connection, depositorLPAccount);
    const currentUserA = await getAccount(provider.connection, depositorMintAAccount);
    const currentUserB = await getAccount(provider.connection, depositorMintBAccount);

    // Withdraw all remaining LP tokens
    const withdrawAmount = new BN(currentUserLP.amount.toString());

    const tx = await program.methods
      .withdrawLiquidity(withdrawAmount)
      .accounts({
        pool: poolPda,
        poolAuthority: poolAuthorityPda,
        mintLiquidity: mintLiquidityPda,
        mintA: mintAKp.publicKey,
        mintB: mintBKp.publicKey,
        poolAccountA: poolAccountA,
        poolAccountB: poolAccountB,
        depositorAccountLiquidity: depositorLPAccount,
        depositorAccountA: depositorMintAAccount,
        depositorAccountB: depositorMintBAccount,
        depositor: depositor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      })
      .signers([depositor])
      .rpc();

    console.log("Full withdraw liquidity success signature", tx);

    // Get final balances
    const finalUserLP = await getAccount(provider.connection, depositorLPAccount);
    const finalUserA = await getAccount(provider.connection, depositorMintAAccount);
    const finalUserB = await getAccount(provider.connection, depositorMintBAccount);
    const finalPoolA = await getAccount(provider.connection, poolAccountA);
    const finalPoolB = await getAccount(provider.connection, poolAccountB);

    console.log("Final User LP balance after full withdrawal:", finalUserLP.amount.toString());
    console.log("Final Pool A balance after full withdrawal:", finalPoolA.amount.toString());
    console.log("Final Pool B balance after full withdrawal:", finalPoolB.amount.toString());

    // Assertions
    assert(finalUserLP.amount.toString() === "0", "All LP tokens should be burned");
    assert(finalUserA.amount > currentUserA.amount, "User should receive remaining token A");
    assert(finalUserB.amount > currentUserB.amount, "User should receive remaining token B");
    assert(finalPoolA.amount.toString() === "0", "Pool A should be empty");
    assert(finalPoolB.amount.toString() === "0", "Pool B should be empty");
  });
});