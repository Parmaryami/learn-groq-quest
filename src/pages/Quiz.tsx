import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface Question {
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

interface Quiz {
  id: string;
  topic: string;
  questions: Question[];
}

interface QuizAttempt {
  id: string;
  score: number;
  total_questions: number;
  completed_at: string;
}

export default function Quiz() {
  const [topic, setTopic] = useState('');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recentAttempts, setRecentAttempts] = useState<QuizAttempt[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadRecentAttempts();
    }
  }, [user]);

  const loadRecentAttempts = async () => {
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', user?.id)
      .order('completed_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error loading attempts:', error);
      return;
    }

    setRecentAttempts(data || []);
  };

  const generateQuiz = async () => {
    if (!topic.trim() || !user) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: { topic: topic.trim() },
      });

      if (error) throw error;

      // Save quiz to database
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .insert({
          user_id: user.id,
          title: topic.trim(),
          subject: topic.trim(),
          questions: data.questions,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      setQuiz({
        id: quizData.id,
        topic: quizData.subject,
        questions: data.questions,
      });
      setCurrentQuestion(0);
      setAnswers([]);
      setShowResults(false);

      toast({
        title: 'Quiz Generated!',
        description: `Created a ${data.questions.length}-question quiz on ${topic}.`,
      });
    } catch (error) {
      console.error('Error generating quiz:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate quiz. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = (answerIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);
  };

  const nextQuestion = () => {
    if (currentQuestion < quiz!.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    if (!quiz || !user) return;

    const score = answers.reduce((total, answer, index) => {
      return total + (answer === quiz.questions[index].correct_answer ? 1 : 0);
    }, 0);

    try {
      await supabase
        .from('quiz_attempts')
        .insert({
          quiz_id: quiz.id,
          user_id: user.id,
          answers,
          score,
          total_questions: quiz.questions.length,
        });

      setShowResults(true);
      loadRecentAttempts();

      toast({
        title: 'Quiz Completed!',
        description: `You scored ${score}/${quiz.questions.length}`,
      });
    } catch (error) {
      console.error('Error saving quiz attempt:', error);
      toast({
        title: 'Error',
        description: 'Failed to save quiz results.',
        variant: 'destructive',
      });
    }
  };

  const restartQuiz = () => {
    setQuiz(null);
    setTopic('');
    setCurrentQuestion(0);
    setAnswers([]);
    setShowResults(false);
  };

  if (showResults && quiz) {
    const score = answers.reduce((total, answer, index) => {
      return total + (answer === quiz.questions[index].correct_answer ? 1 : 0);
    }, 0);

    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Quiz Results: {quiz.topic}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">
                Your Score: {score}/{quiz.questions.length}
              </h3>
              <p className="text-muted-foreground">
                {Math.round((score / quiz.questions.length) * 100)}% Correct
              </p>
            </div>

            <div className="space-y-4">
              {quiz.questions.map((question, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start gap-3">
                    {answers[index] === question.correct_answer ? (
                      <CheckCircle className="h-5 w-5 text-quiz-correct mt-1 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-quiz-incorrect mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium mb-2">{question.question}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Your answer: {question.options[answers[index]]}
                      </p>
                      <p className="text-sm text-success mb-2">
                        Correct answer: {question.options[question.correct_answer]}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {question.explanation}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Button onClick={restartQuiz} className="w-full">
              Take Another Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quiz && !showResults) {
    const question = quiz.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Question {currentQuestion + 1} of {quiz.questions.length}</CardTitle>
            <Progress value={progress} className="w-full" />
          </CardHeader>
          <CardContent className="space-y-6">
            <h3 className="text-lg font-medium">{question.question}</h3>
            
            <RadioGroup
              value={answers[currentQuestion]?.toString()}
              onValueChange={(value) => handleAnswer(parseInt(value))}
            >
              {question.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="flex-1">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <Button
              onClick={nextQuestion}
              disabled={answers[currentQuestion] === undefined}
              className="w-full"
            >
              {currentQuestion === quiz.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Quiz Generator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="topic">Enter a topic for your quiz</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., World War 2, Photosynthesis, Algebra..."
              onKeyPress={(e) => e.key === 'Enter' && generateQuiz()}
            />
          </div>

          <Button
            onClick={generateQuiz}
            disabled={!topic.trim() || isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Quiz...
              </>
            ) : (
              'Generate Quiz'
            )}
          </Button>

          {recentAttempts.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold mb-4">Recent Quiz Attempts</h3>
              <div className="space-y-2">
                {recentAttempts.map((attempt) => (
                  <Card key={attempt.id} className="p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        Score: {attempt.score}/{attempt.total_questions}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(attempt.completed_at).toLocaleDateString()}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}