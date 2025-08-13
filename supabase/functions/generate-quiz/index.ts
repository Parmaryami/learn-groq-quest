import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic } = await req.json();
    
    if (!topic) {
      throw new Error('Topic is required');
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY is not set');
    }

    console.log('Generating quiz for topic:', topic);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an educational quiz generator. Create exactly 5 multiple-choice questions about the given topic.

Return your response as a valid JSON object with this exact structure:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Explanation of why this answer is correct"
    }
  ]
}

Rules:
- Exactly 5 questions
- Each question has exactly 4 options
- correct_answer is the index (0-3) of the correct option
- Questions should be educational and test understanding
- Vary difficulty from basic to intermediate
- Provide clear explanations
- Return ONLY the JSON, no other text`
          },
          {
            role: 'user',
            content: `Create a quiz about: ${topic}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Received response from Groq API');

    const aiResponse = data.choices[0]?.message?.content || '';
    
    try {
      // Parse the JSON response from the AI
      const quizData = JSON.parse(aiResponse);
      
      // Validate the structure
      if (!quizData.questions || !Array.isArray(quizData.questions)) {
        throw new Error('Invalid quiz format: missing questions array');
      }
      
      if (quizData.questions.length !== 5) {
        throw new Error('Invalid quiz format: must have exactly 5 questions');
      }
      
      // Validate each question
      for (const q of quizData.questions) {
        if (!q.question || !q.options || !Array.isArray(q.options) || 
            q.options.length !== 4 || typeof q.correct_answer !== 'number' ||
            q.correct_answer < 0 || q.correct_answer > 3 || !q.explanation) {
          throw new Error('Invalid question format');
        }
      }

      return new Response(
        JSON.stringify(quizData),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );

    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('AI Response:', aiResponse);
      throw new Error('Failed to parse quiz data from AI response');
    }

  } catch (error) {
    console.error('Error in generate-quiz function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
})