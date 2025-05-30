import VoiceAIManagement from '@/components/VoiceAIManagement';
import VoiceAIDemo from '@/components/VoiceAIDemo';
import EmotionDetectionDemo from '@/components/EmotionDetectionDemo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const VoiceAI = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold mb-6">Voice AI Management</h1>
      
      <Tabs defaultValue="management" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="management">Configuration & Testing</TabsTrigger>
          <TabsTrigger value="demo">Demo & Showcase</TabsTrigger>
          <TabsTrigger value="emotion">Emotion Detection</TabsTrigger>
        </TabsList>
        
        <TabsContent value="management">
          <VoiceAIManagement />
        </TabsContent>
        
        <TabsContent value="demo">
          <VoiceAIDemo />
        </TabsContent>
        
        <TabsContent value="emotion">
          <EmotionDetectionDemo />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VoiceAI;
