// Test utility to demonstrate multiple notifications with proper spacing
export const triggerMultipleToasts = (toast: any) => {
  // First notification
  toast({
    title: "Success",
    description: "First notification message",
    variant: "default",
  });

  // Second notification after a brief delay
  setTimeout(() => {
    toast({
      title: "Warning", 
      description: "Second notification with more content to show spacing",
      variant: "destructive",
    });
  }, 500);

  // Third notification
  setTimeout(() => {
    toast({
      title: "Info",
      description: "Third notification to test multiple notifications spacing",
      variant: "default",
    });
  }, 1000);
};
