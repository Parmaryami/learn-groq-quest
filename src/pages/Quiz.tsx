import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Brain, Loader2, CheckCircle, XCircle, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Question {
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

interface Quiz {
  title: string;
  subject: string;
  questions: Question[];
}

export default function QuizPage() {
  const [topic, setTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();

  const generateQuiz = async () => {
    if (!topic.trim() || !user) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: { topic: topic.trim() }
      });

      if (error) throw error;

      setQuiz(data.quiz);
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setShowResults(false);
      setScore(0);

    } catch (error) {
      console.error('Error generating quiz:', error);
      toast({
        title: "Error",
        description: "Failed to generate quiz. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
    }));
  };

  const submitQuiz = async () => {
    if (!quiz || !user) return;

    const calculatedScore = quiz.questions.reduce((score, question, index) => {
      return score + (selectedAnswers[index] === question.correct_answer ? 1 : 0);
    }, 0);

    setScore(calculatedScore);
    setShowResults(true);

    // Save quiz and attempt to database
    try {
      const { data: quizData, error: quizError } = await (supabase as any)
        .from('quizzes')
        .insert({
          user_id: user.id,
          title: quiz.title,
          subject: quiz.subject,
          questions: quiz.questions,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      await (supabase as any).from('quiz_attempts').insert({
        user_id: user.id,
        quiz_id: quizData.id,
        answers: selectedAnswers,
        score: calculatedScore,
        total_questions: quiz.questions.length,
      });

      // Update study topics
      await (supabase as any)
        .from('study_topics')
        .upsert({
          user_id: user.id,
          topic: quiz.title,
          subject: quiz.subject,
          mastery_level: calculatedScore / quiz.questions.length,
          last_studied: new Date().toISOString(),
          study_count: 1,
        }, {
          onConflict: 'user_id,topic,subject'
        });

    } catch (error) {
      console.error('Error saving quiz results:', error);
    }
  };

  const resetQuiz = () => {
    setQuiz(null);
    setTopic("");
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setShowResults(false);
    setScore(0);
  };

  if (!quiz) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <Brain className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-bold mb-2">Quiz Generator</h1>
          <p className="text-muted-foreground">
            Enter any topic and I'll create a custom quiz for you!
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Your Quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">What topic would you like to be quizzed on?</Label>
              <Input
                id="topic"
                placeholder="e.g., Photosynthesis, World War II, Algebra..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && generateQuiz()}
              />
            </div>
            <Button 
              onClick={generateQuiz} 
              disabled={!topic.trim() || isGenerating}
              className="w-full bg-gradient-to-r from-primary to-primary-glow"
            >
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showResults) {
    const percentage = Math.round((score / quiz.questions.length) * 100);
    const getGradeColor = () => {
      if (percentage >= 80) return "text-quiz-correct";
      if (percentage >= 60) return "text-quiz-pending";
      return "text-quiz-incorrect";
    };

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Award className={`h-16 w-16 ${getGradeColor()}`} />
            </div>
            <CardTitle className="text-2xl">Quiz Complete!</CardTitle>
            <div className="text-center">
              <div className={`text-4xl font-bold ${getGradeColor()}`}>
                {score}/{quiz.questions.length}
              </div>
              <div className={`text-lg ${getGradeColor()}`}>
                {percentage}%
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {quiz.questions.map((question, index) => {
              const userAnswer = selectedAnswers[index];
              const isCorrect = userAnswer === question.correct_answer;

              return (
                <Card key={index} className="border-l-4 border-l-muted">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3 mb-3">
                      {isCorrect ? (
                        <CheckCircle className="h-5 w-5 text-quiz-correct mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-quiz-incorrect mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium mb-2">
                          Question {index + 1}: {question.question}
                        </h3>
                        <div className="space-y-2 mb-3">
                          {question.options.map((option, optionIndex) => (
                            <div 
                              key={optionIndex}
                              className={`p-2 rounded text-sm ${
                                optionIndex === question.correct_answer
                                  ? 'bg-quiz-correct/10 border border-quiz-correct'
                                  : userAnswer === optionIndex && !isCorrect
                                  ? 'bg-quiz-incorrect/10 border border-quiz-incorrect'
                                  : 'bg-muted/50'
                              }`}
                            >
                              {option}
                              {optionIndex === question.correct_answer && (
                                <Badge variant="outline" className="ml-2 text-quiz-correct">
                                  Correct
                                </Badge>
                              )}
                              {userAnswer === optionIndex && !isCorrect && (
                                <Badge variant="outline" className="ml-2 text-quiz-incorrect">
                                  Your Answer
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <strong>Explanation:</strong> {question.explanation}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <div className="flex gap-2">
              <Button onClick={resetQuiz} variant="outline" className="flex-1">
                Take Another Quiz
              </Button>
              <Button 
                onClick={() => generateQuiz()}
                className="flex-1 bg-gradient-to-r from-primary to-primary-glow"
              >
                Retry This Topic
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{quiz.title}</h1>
          <Badge variant="secondary">{quiz.subject}</Badge>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Question</div>
          <div className="font-bold">
            {currentQuestionIndex + 1} of {quiz.questions.length}
          </div>
        </div>
      </div>

      <Progress value={progress} className="h-2" />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {currentQuestion.question}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={selectedAnswers[currentQuestionIndex]?.toString()}
            onValueChange={(value) => handleAnswerSelect(currentQuestionIndex, parseInt(value))}
          >
            {currentQuestion.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>

            {currentQuestionIndex === quiz.questions.length - 1 ? (
              <Button
                onClick={submitQuiz}
                disabled={selectedAnswers[currentQuestionIndex] === undefined}
                className="bg-gradient-to-r from-secondary to-accent"
              >
                Submit Quiz
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                disabled={selectedAnswers[currentQuestionIndex] === undefined}
                className="bg-gradient-to-r from-primary to-primary-glow"
              >
                Next
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}