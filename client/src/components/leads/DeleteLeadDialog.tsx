import { useState } from 'react';
import { 
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { leadsApi } from '@/services/leadsApi';

interface DeleteLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  onSuccess: () => void;
}

const DeleteLeadDialog = ({
  open,
  onOpenChange,
  leadId,
  leadName,
  onSuccess,
}: DeleteLeadDialogProps) => {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    
    try {
      await leadsApi.deleteLead(leadId);
      
      toast({
        title: "Success",
        description: "Lead deleted successfully.",
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting lead:', error);
      
      toast({
        title: "Error",
        description: "Failed to delete lead. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Lead</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{leadName}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteLeadDialog;
