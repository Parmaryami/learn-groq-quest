import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, FileText, BarChart3, Brain, Sparkles } from 'lucide-react';

const Index = () => {
  const features = [
    {
      icon: MessageSquare,
      title: 'AI Chat Tutor',
      description: 'Ask questions and get detailed explanations with examples and practice problems',
      href: '/chat',
      color: 'text-primary',
    },
    {
      icon: FileText,
      title: 'Quiz Generator',
      description: 'Generate custom quizzes on any topic and test your knowledge',
      href: '/quiz',
      color: 'text-success',
    },
    {
      icon: BarChart3,
      title: 'Progress Tracking',
      description: 'Monitor your learning progress and identify areas for improvement',
      href: '/progress',
      color: 'text-warning',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="h-16 w-16 bg-gradient-to-br from-primary to-primary-glow rounded-2xl flex items-center justify-center shadow-xl">
              <Brain className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Welcome to LearnQuest
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Your personalized AI-powered learning platform. Master any subject with intelligent tutoring, 
            custom quizzes, and progress tracking designed just for you.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-8">
            <Sparkles className="h-4 w-4" />
            <span>Powered by Advanced AI</span>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {features.map((feature) => (
            <Card key={feature.title} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader>
                <div className={`h-12 w-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link to={feature.href}>
                    Get Started
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Start Section */}
        <Card className="bg-gradient-to-r from-primary/5 to-primary-glow/5 border-primary/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Ready to Start Learning?</CardTitle>
            <CardDescription className="text-base">
              Jump right in with our most popular feature
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/chat">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Start AI Chat
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/quiz">
                  <FileText className="h-5 w-5 mr-2" />
                  Generate Quiz
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
