import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  role: string;
  created_at: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading sessions:', error);
      return;
    }

    setSessions(data || []);
    if (data && data.length > 0 && !currentSession) {
      setCurrentSession(data[0].id);
      loadMessages(data[0].id);
    }
  };

  const loadMessages = async (sessionId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    setMessages(data?.map(msg => ({
      id: msg.id,
      content: msg.content,
      role: msg.role,
      created_at: msg.created_at
    })) || []);
  };

  const createNewSession = async () => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user?.id,
        title: 'New Chat',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return;
    }

    setSessions([data, ...sessions]);
    setCurrentSession(data.id);
    setMessages([]);
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentSession || !user) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message to state immediately
    const tempUserMessage: Message = {
      id: 'temp-user',
      content: userMessage,
      role: 'user',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      // Save user message to database
      const { error: userMsgError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: currentSession,
          user_id: user.id,
          content: userMessage,
          role: 'user',
        });

      if (userMsgError) throw userMsgError;

      // Call AI function
      const { data, error } = await supabase.functions.invoke('chat-with-groq', {
        body: { message: userMessage, sessionId: currentSession },
      });

      if (error) throw error;

      // Add AI response to state
      const aiMessage: Message = {
        id: 'temp-ai',
        content: data.response,
        role: 'assistant',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev.slice(0, -1), tempUserMessage, aiMessage]);

      // Save AI message to database
      await supabase
        .from('chat_messages')
        .insert({
          session_id: currentSession,
          user_id: user.id,
          content: data.response,
          role: 'assistant',
        });

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
      // Remove temp user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!currentSession && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <CardContent>
            <h2 className="text-2xl font-bold mb-4">Start Learning with AI</h2>
            <p className="text-muted-foreground mb-6">
              Ask any academic question and get detailed explanations, examples, and practice questions.
            </p>
            <Button onClick={createNewSession}>Start New Chat</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sessions Sidebar */}
      <div className="w-64 border-r bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Chat History</h3>
          <Button variant="outline" size="sm" onClick={createNewSession}>
            New
          </Button>
        </div>
        <ScrollArea className="h-full">
          <div className="space-y-2">
            {sessions.map((session) => (
              <Button
                key={session.id}
                variant={currentSession === session.id ? 'secondary' : 'ghost'}
                className="w-full justify-start text-left h-auto p-3"
                onClick={() => {
                  setCurrentSession(session.id);
                  loadMessages(session.id);
                }}
              >
                <div className="truncate">
                  <div className="font-medium truncate">{session.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(session.created_at).toLocaleDateString()}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((message, index) => (
              <div
                key={`${message.id}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <Card
                  className={`max-w-[80%] ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </CardContent>
                </Card>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <Card className="bg-muted">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>AI is thinking...</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask any academic question..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}