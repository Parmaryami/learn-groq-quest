import { useState, useEffect, useRef } from "react";
import { Send, Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  subject?: string;
  created_at: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const loadSessions = async () => {
    if (!user) return;

    const { data, error } = await (supabase as any)
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading sessions:', error);
      return;
    }

    setSessions(data || []);
  };

  const createNewSession = async (subject?: string) => {
    if (!user) return null;

    const { data, error } = await (supabase as any)
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        title: subject ? `${subject} Discussion` : 'New Chat',
        subject,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return null;
    }

    setCurrentSession(data);
    setMessages([]);
    loadSessions();
    return data;
  };

  const loadSessionMessages = async (sessionId: string) => {
    const { data, error } = await (supabase as any)
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    const formattedMessages = data.map((msg: any) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.created_at),
    }));

    setMessages(formattedMessages);
  };

  const selectSession = (session: ChatSession) => {
    setCurrentSession(session);
    loadSessionMessages(session.id);
  };

  const saveMessage = async (sessionId: string, role: 'user' | 'assistant', content: string) => {
    if (!user) return;

    await (supabase as any).from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      role,
      content,
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !user) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      // Create session if none exists
      let session = currentSession;
      if (!session) {
        session = await createNewSession();
        if (!session) {
          throw new Error('Failed to create session');
        }
      }

      // Add user message to UI and save
      const newUserMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newUserMessage]);
      await saveMessage(session.id, 'user', userMessage);

      // Call AI API
      const { data, error } = await supabase.functions.invoke('chat-with-groq', {
        body: { 
          message: userMessage,
          sessionId: session.id 
        }
      });

      if (error) throw error;

      // Add AI response to UI and save
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
      await saveMessage(session.id, 'assistant', data.response);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
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

  return (
    <div className="h-full flex gap-6">
      {/* Sessions Sidebar */}
      <div className="w-80 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Chat Sessions</h2>
          <Button 
            onClick={() => createNewSession()} 
            size="sm"
            className="bg-gradient-to-r from-primary to-primary-glow"
          >
            New Chat
          </Button>
        </div>
        
        <ScrollArea className="h-[calc(100vh-12rem)]">
          <div className="space-y-2">
            {sessions.map((session) => (
              <Card 
                key={session.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  currentSession?.id === session.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => selectSession(session)}
              >
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-sm truncate">{session.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {session.subject && (
                      <Badge variant="secondary" className="text-xs">
                        {session.subject}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Learning Assistant
            {currentSession && (
              <Badge variant="outline" className="ml-auto">
                {currentSession.subject || 'General'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages */}
          <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                  <Brain className="h-12 w-12 mx-auto mb-4 text-primary/50" />
                  <p>Start a conversation with your AI learning assistant!</p>
                  <p className="text-sm mt-2">Ask academic questions and get simple explanations with examples.</p>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ask a question about any academic topic..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                onClick={sendMessage} 
                disabled={isLoading || !input.trim()}
                className="bg-gradient-to-r from-primary to-primary-glow"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}