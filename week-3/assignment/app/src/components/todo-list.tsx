"use client";

import useAnchorProvider from "@/hooks/use-anchor-provider";
import TodoProgram from "@/lib/todo-program";
import { Center, Flex, List, Spinner, Text, useToast } from "@chakra-ui/react";
import { IdlAccounts } from "@coral-xyz/anchor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IDL } from "../../../target/types/todo_app";
import TodoItem from "./todo-item";

export default function TodoList({
  profile,
}: {
  profile: IdlAccounts<typeof IDL>["profile"];
}) {
  const provider = useAnchorProvider();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: todoResults, isLoading } = useQuery({
  queryKey: ["todos", profile.key.toBase58(), profile.todoCount],
  enabled: !!profile,
  queryFn: () => new TodoProgram(provider).fetchTodos(profile),
});

console.log("todoResults", todoResults?.length);

  const { mutateAsync: toggleTodo } = useMutation({
    mutationFn: async (todoIndex: number) => {
      const program = new TodoProgram(provider);
      const tx = await program.toggleTodo(todoIndex);
      const signature = await provider.sendAndConfirm(tx);
      return signature;
    },
    onSuccess: (signature) => {
      toast({
        title: "Todo toggled successfully",
        status: "success",
      });
      
      // Refresh todos
      queryClient.invalidateQueries({
        queryKey: ["todos", profile.key.toBase58(), profile.todoCount],
      });
    },
    onError: (error) => {
      console.error("Toggle error:", error);
      toast({
        title: "Failed to toggle todo",
        status: "error",
      });
    },
  });

  const { mutateAsync: deleteTodo } = useMutation({
    mutationFn: async (todoIndex: number) => {
      const program = new TodoProgram(provider);
      const tx = await program.deleteTodo(todoIndex);
      const signature = await provider.sendAndConfirm(tx);
      return signature;
    },
    onSuccess: (signature) => {
      toast({
        title: "Todo deleted successfully",
        description: "Rent has been returned to your account",
        status: "success",
      });
      
      // Refresh both todos and profile (to update todo count)
      queryClient.invalidateQueries({
        queryKey: ["todos", profile.key.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["profile", provider.publicKey.toBase58()],
      });
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast({
        title: "Failed to delete todo",
        status: "error",
      });
    },
  });

  const handleToggle = (todoIndex: number) => {
    toggleTodo(todoIndex);
  };

  const handleDelete = (todoIndex: number) => {
    deleteTodo(todoIndex);
  };

  if (isLoading) {
    return (
      <Center as={Flex} direction="column" gap={4} py={8}>
        <Spinner size="xl" colorScheme="blue" />
        <Text>Loading...</Text>
      </Center>
    );
  }

  console.log("todoResults", todoResults?.length);

  return (
  <List>
    {todoResults?.map((todoResult, uiIndex) => (
      <TodoItem
        key={todoResult.actualIndex} // Use actual index as key
        content={todoResult.todo.content}
        completed={todoResult.todo.completed}
        onToggle={() => handleToggle(todoResult.actualIndex)} // Use actual index
        onDelete={() => handleDelete(todoResult.actualIndex)} // Use actual index
      />
    ))}
  </List>
);
}