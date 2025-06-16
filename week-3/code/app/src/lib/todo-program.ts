import { AnchorProvider, IdlAccounts, Program, utils } from "@coral-xyz/anchor";
import { type TodoApp } from "../../../target/types/todo_app"; // Changed to type import
import idl from "../../../target/idl/todo_app.json"; // Import the actual IDL JSON
import { Cluster, PublicKey, SystemProgram } from "@solana/web3.js";
import { getProgramId } from "./helper";

export default class TodoProgram {
  program: Program<TodoApp>;
  provider: AnchorProvider;

  constructor(provider: AnchorProvider, cluster: Cluster = "devnet") {
    this.provider = provider;
    this.program = new Program(idl as TodoApp, provider);
  }

  createProfile(name: string) {
    const [profile] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), this.provider.publicKey.toBytes()], // Đã thay đổi sang Buffer.from
      this.program.programId
    );

    const builder = this.program.methods.createProfile(name).accounts({
      creator: this.provider.publicKey,
      profile,
      systemProgram: SystemProgram.programId,
    });

    return builder.transaction();
  }

  fetchProfile() {
    const [profile] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), this.provider.publicKey.toBytes()], // Đã thay đổi sang Buffer.from
      this.program.programId
    );

    return this.program.account.profile.fetch(profile);
  }

  createTodo(content: string, todoIndex: number) {
    const [profile] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), this.provider.publicKey.toBytes()], // Giữ nguyên Buffer.from
      this.program.programId
    );

    const [todo] = PublicKey.findProgramAddressSync(
      [Buffer.from("todo"), profile.toBytes(), Buffer.from([todoIndex])],
      this.program.programId
    );

    const builder = this.program.methods.createTodo(content).accounts({
      creator: this.provider.publicKey,
      profile,
      todo,
      systemProgram: SystemProgram.programId,
    });

    return builder.transaction();
  }

  async fetchTodos(profile: IdlAccounts<typeof idl>["profile"]) {
    const todoCount = profile.todoCount;

    const todoPdas: PublicKey[] = [];

    for (let i = 0; i < todoCount; i++) {
      const [todo] = PublicKey.findProgramAddressSync(
        [Buffer.from("todo"), profile.key.toBytes(), Buffer.from([i])],
        this.program.programId
      );

      todoPdas.push(todo);
    }

    return Promise.all(
      todoPdas.map((pda) => this.program.account.todo.fetch(pda))
    );
  }

  // Tính năng 1: Toggle completion status của todo
  toggleTodo(todoIndex: number) {
    const [profile] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), this.provider.publicKey.toBytes()],
      this.program.programId
    );

    const [todo] = PublicKey.findProgramAddressSync(
      [Buffer.from("todo"), profile.toBytes(), Buffer.from([todoIndex])],
      this.program.programId
    );

    const builder = this.program.methods.toggleTodo().accounts({
      creator: this.provider.publicKey,
      profile,
      todo,
      systemProgram: SystemProgram.programId,
    });

    return builder.transaction();
  }

  // Tính năng 2: Delete todo (bonus feature)
  deleteTodo(todoIndex: number) {
    const [profile] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), this.provider.publicKey.toBytes()],
      this.program.programId  
    );

    const [todo] = PublicKey.findProgramAddressSync(
      [Buffer.from("todo"), profile.toBytes(), Buffer.from([todoIndex])],
      this.program.programId
    );

    const builder = this.program.methods.deleteTodo().accounts({
      creator: this.provider.publicKey,
      profile,
      todo,
      systemProgram: SystemProgram.programId,
    });

    return builder.transaction();
  }
}
