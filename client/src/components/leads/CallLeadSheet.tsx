import { useState } from 'react';
import { Phone, X } from 'lucide-react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../ui/select';
import { useToast } from '../ui/use-toast';

interface CallLeadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    name: string;
    phoneNumber: string;
    company: string;
    languagePreference: string;
  };
  onSuccess: () => void;
}

// Placeholder for actual call API
const mockInitiateCall = async () => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 2000));
  return { callId: 'call-123', status: 'initiated' };
};

const CallLeadSheet = ({
  open,
  onOpenChange,
  lead,
  onSuccess,
}: CallLeadSheetProps) => {
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = useState(lead.languagePreference || 'English');
  const [isCallingInProgress, setIsCallingInProgress] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'connected' | 'completed' | 'failed'>('idle');
  const [notes, setNotes] = useState('');

  // Initiate call
  const handleInitiateCall = async () => {
    setIsCallingInProgress(true);
    setCallStatus('connecting');
    
    try {
      // In a real implementation, this would use the actual call API
      await mockInitiateCall();
      
      // Simulate call connection after a delay
      setTimeout(() => {
        setCallStatus('connected');
        
        // Simulate call completion after a delay
        setTimeout(() => {
          setCallStatus('completed');
          setIsCallingInProgress(false);
          
          toast({
            title: "Call Completed",
            description: "Call has been completed successfully.",
          });
        }, 5000);
      }, 3000);
    } catch (error) {
      console.error('Error initiating call:', error);
      setCallStatus('failed');
      setIsCallingInProgress(false);
      
      toast({
        title: "Call Failed",
        description: "Failed to connect the call. Please try again.",
        variant: "destructive",
      });
    }
  };

  // End call
  const handleEndCall = () => {
    setCallStatus('completed');
    setIsCallingInProgress(false);
    
    toast({
      title: "Call Ended",
      description: "Call has been ended by user.",
    });
  };

  // Save call notes and close
  const handleSaveAndClose = () => {
    // In a real implementation, this would save the call notes to the API
    onSuccess();
    onOpenChange(false);
    
    // Reset state for next time
    setCallStatus('idle');
    setNotes('');
  };

  return (
    <Sheet open={open} onOpenChange={(newOpen) => {
      // Prevent closing if call is in progress
      if (isCallingInProgress && newOpen === false) {
        toast({
          title: "Call in Progress",
          description: "Please end the call before closing this window.",
          variant: "destructive",
        });
        return;
      }
      onOpenChange(newOpen);
    }}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader className="flex items-center justify-between">
          <SheetTitle>Call Lead</SheetTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onOpenChange(false)}
            disabled={isCallingInProgress}
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Lead Info */}
          <Card className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{lead.name}</h3>
                <span className="text-sm text-muted-foreground">{lead.company}</span>
              </div>
              <p className="text-sm font-medium">
                {lead.phoneNumber}
              </p>
              <p className="text-sm text-muted-foreground">
                Preferred Language: {lead.languagePreference || 'English'}
              </p>
            </div>
          </Card>

          {/* Language Selection */}
          <div className="space-y-2">
            <Label htmlFor="language">Call Language</Label>
            <Select 
              value={selectedLanguage} 
              onValueChange={setSelectedLanguage}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Spanish">Spanish</SelectItem>
                <SelectItem value="French">French</SelectItem>
                <SelectItem value="German">German</SelectItem>
                <SelectItem value="Italian">Italian</SelectItem>
                <SelectItem value="Portuguese">Portuguese</SelectItem>
                <SelectItem value="Arabic">Arabic</SelectItem>
                <SelectItem value="Hindi">Hindi</SelectItem>
                <SelectItem value="Mandarin">Mandarin</SelectItem>
                <SelectItem value="Japanese">Japanese</SelectItem>
                <SelectItem value="Korean">Korean</SelectItem>
                <SelectItem value="Russian">Russian</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Call Status */}
          <div className="space-y-4">
            <div className="flex justify-center">
              {callStatus === 'idle' ? (
                <Button 
                  onClick={handleInitiateCall} 
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Start Call
                </Button>
              ) : callStatus === 'connecting' ? (
                <div className="text-center space-y-2">
                  <div className="animate-pulse flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 text-amber-800 mx-auto">
                    <Phone className="h-6 w-6" />
                  </div>
                  <p>Connecting call...</p>
                </div>
              ) : callStatus === 'connected' ? (
                <div className="space-y-2 text-center">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-100 text-green-800 mx-auto">
                    <Phone className="h-6 w-6" />
                  </div>
                  <p>Call in progress</p>
                  <Button 
                    onClick={handleEndCall} 
                    variant="destructive"
                  >
                    End Call
                  </Button>
                </div>
              ) : callStatus === 'completed' ? (
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-800 mx-auto">
                    <Phone className="h-6 w-6" />
                  </div>
                  <p>Call completed</p>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-800 mx-auto">
                    <Phone className="h-6 w-6" />
                  </div>
                  <p>Call failed</p>
                  <Button 
                    onClick={handleInitiateCall} 
                    variant="outline"
                  >
                    Retry Call
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Call Notes */}
          {(callStatus === 'connected' || callStatus === 'completed') && (
            <div className="space-y-2">
              <Label htmlFor="notes">Call Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this call..."
                rows={4}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCallingInProgress}
            >
              Cancel
            </Button>
            
            {callStatus === 'completed' && (
              <Button onClick={handleSaveAndClose}>
                Save & Close
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CallLeadSheet;
