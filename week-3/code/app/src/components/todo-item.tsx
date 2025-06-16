"use client";

import useAnchorProvider from "@/hooks/use-anchor-provider";
import TodoProgram from "@/lib/todo-program";
import {
  Box,
  Button,
  Checkbox,
  Flex,
  ListItem,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface TodoItemProps {
  content: string;
  completed: boolean;
  index: number; // Index của todo trong danh sách
}

export default function TodoItem({ content, completed, index }: TodoItemProps) {
  const provider = useAnchorProvider();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Toggle todo mutation
  const { mutate: toggleTodo, isPending: isToggling } = useMutation({
    mutationKey: ["toggle-todo", index],
    mutationFn: async () => {
      const program = new TodoProgram(provider);
      const tx = await program.toggleTodo(index);
      return await provider.sendAndConfirm(tx);
    },
    onSuccess: (signature) => {
      console.log("Toggle signature:", signature);
      toast({
        title: "Todo updated successfully",
        status: "success",
      });
      
      // Invalidate queries để refresh data
      queryClient.invalidateQueries({
        queryKey: ["profile", provider.publicKey.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["todos"],
      });
    },
    onError: (error) => {
      console.error("Error toggling todo:", error);
      toast({
        title: "Failed to update todo",
        description: error.message,
        status: "error",
      });
    },
  });

  // Delete todo mutation
  const { mutate: deleteTodo, isPending: isDeleting } = useMutation({
    mutationKey: ["delete-todo", index],
    mutationFn: async () => {
      const program = new TodoProgram(provider);
      const tx = await program.deleteTodo(index);
      return await provider.sendAndConfirm(tx);
    },
    onSuccess: (signature) => {
      console.log("Delete signature:", signature);
      toast({
        title: "Todo deleted successfully",
        status: "success",
      });
      
      // Invalidate queries để refresh data
      queryClient.invalidateQueries({
        queryKey: ["profile", provider.publicKey.toBase58()],
      });
      queryClient.invalidateQueries({
        queryKey: ["todos"],
      });
    },
    onError: (error) => {
      console.error("Error deleting todo:", error);
      toast({
        title: "Failed to delete todo",
        description: error.message,
        status: "error",
      });
    },
  });

  const handleToggle = () => {
    toggleTodo();
  };

  const handleDelete = () => {
    if (window.confirm("Bạn có chắc muốn xóa todo này?")) {
      deleteTodo();
    }
  };

  return (
    <ListItem>
      <Flex
        align="center"
        justify="space-between"
        p={4}
        border="1px"
        borderColor="gray.200"
        borderRadius="md"
        bg="white"
        _hover={{ bg: "gray.50" }}
      >
        <Flex align="center" gap={3} flex={1}>
          <Checkbox
            isChecked={completed}
            onChange={handleToggle}
            isDisabled={isToggling || isDeleting}
            colorScheme="blue"
          />
          <Text
            textDecoration={completed ? "line-through" : "none"}
            color={completed ? "gray.500" : "gray.800"}
            fontSize="md"
          >
            {content}
          </Text>
        </Flex>

        <Button
          onClick={handleDelete}
          isLoading={isDeleting}
          isDisabled={isToggling}
          size="sm"
          colorScheme="red"
          variant="ghost"
        >
          Xóa
        </Button>
      </Flex>
    </ListItem>
  );
}