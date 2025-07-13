import { AnchorProvider, IdlAccounts, Program, utils } from "@coral-xyz/anchor";
import { TodoApp } from "../../../target/types/todo_app";
import { Cluster, PublicKey, SystemProgram } from "@solana/web3.js";

// Import IDL từ file JSON
import idlJson from "../../../target/idl/todo_app.json";

// Cast IDL JSON thành TodoApp type
const IDL: TodoApp = idlJson as TodoApp;

export default class TodoProgram {
  program: Program<TodoApp>;
  provider: AnchorProvider;

  constructor(provider: AnchorProvider, cluster: Cluster = "devnet") {
    this.provider = provider;
    // Không truyền programId - Anchor v0.30.0+ changes
    this.program = new Program(IDL, provider);
  }

  createProfile(name: string) {
    const [profile] = PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode("profile"), this.provider.publicKey.toBytes()],
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
      [utils.bytes.utf8.encode("profile"), this.provider.publicKey.toBytes()],
      this.program.programId
    );

    return this.program.account.profile.fetch(profile);
  }

  createTodo(content: string, todoIndex: number) {
    const [profile] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), this.provider.publicKey.toBytes()],
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
    user: this.provider.publicKey,
    profile,
    todo,
  });

  return builder.transaction();
}

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
    user: this.provider.publicKey,
    profile,
    todo,
  });

  return builder.transaction();
}

async fetchTodos(profile: IdlAccounts<typeof IDL>["profile"]) {
  const todoCount = profile.todoCount;

  const todoResults: Array<{todo: any, actualIndex: number}> = [];

  for (let i = 0; i < todoCount; i++) {
    const [todoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("todo"), profile.key.toBytes(), Buffer.from([i])],
      this.program.programId
    );

    try {
      const todo = await this.program.account.todo.fetch(todoPda);
      todoResults.push({ todo, actualIndex: i });
    } catch (error) {
      // Todo deleted, skip
      console.log(`Todo ${i} not found (deleted)`);
    }
  }

  return todoResults;
}
}