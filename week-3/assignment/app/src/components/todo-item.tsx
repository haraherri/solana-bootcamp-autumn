"use client";

import { Button, Checkbox, Flex, ListItem } from "@chakra-ui/react";

export default function TodoItem({
  content,
  completed = false,
  onToggle,
  onDelete,
}: {
  content: string;
  completed?: boolean;
  onToggle?: () => void;
  onDelete?: () => void;
}) {
  return (
    <ListItem borderBottomColor="gray.500" borderBottomWidth="1px" py={4}>
      <Flex justify="space-between" align="center">
        <Checkbox
          isChecked={completed}
          onChange={onToggle}
          sx={{
            textDecoration: completed ? "line-through" : "initial",
          }}
        >
          {content}
        </Checkbox>
        <Button
          size="sm"
          colorScheme="red"
          variant="outline"
          onClick={onDelete}
        >
          Delete
        </Button>
      </Flex>
    </ListItem>
  );
}