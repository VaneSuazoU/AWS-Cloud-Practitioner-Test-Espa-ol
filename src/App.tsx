import React, { useState, useEffect } from 'react';
import { 
  IonApp, 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonButton, 
  IonIcon,
  IonProgressBar,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonLabel,
  IonItem,
  IonLoading,
  IonAlert,
  IonRadioGroup,
  IonRadio,
  IonCheckbox,
  IonBadge,
  IonList,
  IonListHeader,
  IonModal
} from '@ionic/react';
import { 
  checkmarkCircle, 
  closeCircle, 
  arrowForward, 
  refreshOutline, 
  timeOutline, 
  helpCircleOutline 
} from 'ionicons/icons';

// Imports de CSS
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

import './theme/variables.css';

// Definición de interfaces
interface Question {
  id: number;
  type: 'single' | 'multiple';
  question: string;
  options: {
    [key: string]: string;
  };
  answer: string | string[];
  explanation: string;
}

interface QuizConfig {
  numberOfQuestions: number;
  timeLimit: number;
}

interface QuizState {
  usedQuestionIds: Set<number>;
  currentSession: {
    questions: Question[];
    currentIndex: number;
    score: number;
  };
}

interface WrongAnswer {
  question: Question;
  userAnswer: string | string[];
}

const App: React.FC = () => {
  // Estados principales
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuiz, setCurrentQuiz] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  
  // Estados de control
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isQuizStarted, setIsQuizStarted] = useState(false);
  
  // Estado para rastrear preguntas usadas
  const [quizState, setQuizState] = useState<QuizState>({
    usedQuestionIds: new Set<number>(),
    currentSession: {
      questions: [],
      currentIndex: 0,
      score: 0
    }
  });

  // Configuración del quiz
  const [config, setConfig] = useState<QuizConfig>({
    numberOfQuestions: 10,
    timeLimit: 30
  });

  // NUEVA FUNCIONALIDAD: Estados para posponer preguntas
  const [postponedQuestions, setPostponedQuestions] = useState<number[]>([]);
  const [isPostponedModalOpen, setIsPostponedModalOpen] = useState(false);
  const [completedQuestions, setCompletedQuestions] = useState<number[]>([]);
  const [originalQuestionOrder, setOriginalQuestionOrder] = useState<number[]>([]);

  // Cargar preguntas desde el JSON
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const response = await fetch(`${process.env.PUBLIC_URL}/questions.json`);
        const data = await response.json();
        setQuestions(data.questions);
        setLoading(false);
      } catch (error) {
        console.error('Error cargando preguntas:', error);
        setError('No se pudieron cargar las preguntas');
        setLoading(false);
      }
    };

    loadQuestions();
  }, []);

  // Gestión del tiempo
  useEffect(() => {
    let timer: number;
    if (isQuizStarted && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            finishQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isQuizStarted, timeLeft]);

  // Función auxiliar para obtener preguntas aleatorias sin repetición
  const getRandomQuestionsWithoutRepetition = (allQuestions: Question[], count: number, usedIds: Set<number>): Question[] => {
    const availableQuestions = allQuestions.filter(q => !usedIds.has(q.id));
    
    if (availableQuestions.length < count) {
      // Si no hay suficientes preguntas disponibles, resetear las preguntas usadas
      return getRandomQuestionsWithoutRepetition(allQuestions, count, new Set());
    }

    const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Función para actualizar el estado de preguntas usadas
  const updateUsedQuestions = (newQuestions: Question[]) => {
    setQuizState(prevState => {
      const newUsedIds = new Set(prevState.usedQuestionIds);
      newQuestions.forEach(q => newUsedIds.add(q.id));
      return {
        ...prevState,
        usedQuestionIds: newUsedIds,
        currentSession: {
          questions: newQuestions,
          currentIndex: 0,
          score: 0
        }
      };
    });
  };

  // Iniciar el quiz
  const startQuiz = () => {
    // Obtener preguntas aleatorias sin repetición
    const selectedQuestions = getRandomQuestionsWithoutRepetition(
      questions,
      config.numberOfQuestions,
      quizState.usedQuestionIds
    );
    
    // Actualizar el estado de preguntas usadas
    updateUsedQuestions(selectedQuestions);
    
    // Actualizar estado del quiz
    setCurrentQuiz(selectedQuestions);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsChecked(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setWrongAnswers([]);
    
    // NUEVA FUNCIONALIDAD: Reiniciar estados de preguntas pospuestas
    setPostponedQuestions([]);
    setCompletedQuestions([]);
    // Guardar el orden original de las preguntas para referencia
    setOriginalQuestionOrder(Array.from({ length: selectedQuestions.length }, (_, i) => i));
    
    // Configurar tiempo
    setTimeLeft(config.timeLimit * 60);
    setIsQuizStarted(true);
  };

  // Finalizar quiz
  const finishQuiz = () => {
    // Verificar si todavía hay preguntas pospuestas sin completar
    const pendingPostponed = postponedQuestions.filter(idx => !completedQuestions.includes(idx));
    
    if (pendingPostponed.length > 0) {
      // Si hay preguntas pospuestas pendientes, ir a la primera
      setCurrentQuestionIndex(pendingPostponed[0]);
      setSelectedAnswer(null);
      setIsChecked(false);
      setIsPostponedModalOpen(true);
      return;
    }
    
    // Si no hay preguntas pendientes, finalizar el quiz
    setIsQuizStarted(false);
    // Calcular y guardar puntuación final
    const finalScore = (correctCount / currentQuiz.length) * 100;
    setQuizState(prevState => ({
      ...prevState,
      currentSession: {
        ...prevState.currentSession,
        score: finalScore
      }
    }));
  };

  // Selección de respuesta
  const handleAnswerSelect = (answerId: string) => {
    if (!isQuizStarted || isChecked) return;
    
    const currentQuestion = currentQuiz[currentQuestionIndex];
    
    setSelectedAnswer((prev) => {
      if (currentQuestion.type === 'single') {
        return answerId;
      } else {
        const currentSelected = Array.isArray(prev) ? [...prev] : [];
        const index = currentSelected.indexOf(answerId);
        
        if (index > -1) {
          currentSelected.splice(index, 1);
        } else {
          currentSelected.push(answerId);
        }
        
        return currentSelected;
      }
    });
    
    setIsChecked(false);
  };

  // Comprobar respuesta
  const checkAnswer = () => {
    if (!selectedAnswer) return;

    const currentQuestion = currentQuiz[currentQuestionIndex];
    let isAnswerCorrect = false;

    if (currentQuestion.type === 'single') {
      isAnswerCorrect = selectedAnswer === currentQuestion.answer;
    } else {
      const selectedAns = Array.isArray(selectedAnswer) ? selectedAnswer : [];
      const correctAnswers = currentQuestion.answer as string[];
      
      isAnswerCorrect = 
        selectedAns.length === correctAnswers.length &&
        selectedAns.every(answer => correctAnswers.includes(answer)) &&
        correctAnswers.every(answer => selectedAns.includes(answer));
    }

    setIsCorrect(isAnswerCorrect);
    setIsChecked(true);

    if (isAnswerCorrect) {
      setCorrectCount(prev => prev + 1);
    } else {
      setIncorrectCount(prev => prev + 1);
      // Guardar la pregunta incorrecta
      setWrongAnswers(prev => [...prev, {
        question: currentQuestion,
        userAnswer: selectedAnswer
      }]);
    }

    // NUEVA FUNCIONALIDAD: Marcar esta pregunta como completada
    if (!completedQuestions.includes(currentQuestionIndex)) {
      setCompletedQuestions(prev => [...prev, currentQuestionIndex]);
    }

    // NUEVA FUNCIONALIDAD: Si esta pregunta estaba pospuesta, eliminarla de la lista de pospuestas
    if (postponedQuestions.includes(currentQuestionIndex)) {
      setPostponedQuestions(prev => prev.filter(idx => idx !== currentQuestionIndex));
    }

    // Actualizar puntuación en tiempo real
    const currentScore = ((isAnswerCorrect ? correctCount + 1 : correctCount) / currentQuiz.length) * 100;
    setQuizState(prevState => ({
      ...prevState,
      currentSession: {
        ...prevState.currentSession,
        score: currentScore
      }
    }));
  };

  // NUEVA FUNCIONALIDAD: Posponer la pregunta actual
  const postponeQuestion = () => {
    if (isChecked) return; // No permitir posponer si ya se ha comprobado la respuesta
    
    // Agregar el índice actual a la lista de pospuestas
    if (!postponedQuestions.includes(currentQuestionIndex)) {
      setPostponedQuestions(prev => [...prev, currentQuestionIndex]);
    }
    
    // Ir a la siguiente pregunta no pospuesta
    goToNextNonPostponedQuestion();
  };

  // NUEVA FUNCIONALIDAD: Ir a la siguiente pregunta no pospuesta
  const goToNextNonPostponedQuestion = () => {
    let nextIndex = currentQuestionIndex + 1;
    
    // Buscar la próxima pregunta que no esté pospuesta y no esté completada
    while (
      nextIndex < currentQuiz.length && 
      (postponedQuestions.includes(nextIndex) || completedQuestions.includes(nextIndex))
    ) {
      nextIndex++;
    }
    
    // Si llegamos al final, verificar si hay preguntas pospuestas sin completar
    if (nextIndex >= currentQuiz.length) {
      const pendingPostponed = postponedQuestions.filter(idx => !completedQuestions.includes(idx));
      
      if (pendingPostponed.length > 0) {
        // Ir a la primera pregunta pospuesta sin completar
        setCurrentQuestionIndex(pendingPostponed[0]);
        setIsPostponedModalOpen(true);
      } else {
        // Si no hay preguntas pospuestas pendientes, terminar el quiz
        finishQuiz();
      }
    } else {
      // Ir a la siguiente pregunta no pospuesta
      setCurrentQuestionIndex(nextIndex);
    }
    
    // Resetear el estado para la nueva pregunta
    setSelectedAnswer(null);
    setIsChecked(false);
  };

  // NUEVA FUNCIONALIDAD: Ir a una pregunta pospuesta específica
  const goToPostponedQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    setIsPostponedModalOpen(false);
    setSelectedAnswer(null);
    setIsChecked(false);
  };

  // Siguiente pregunta
  const nextQuestion = () => {
    // Marcar la pregunta actual como completada (si aún no lo está)
    if (!completedQuestions.includes(currentQuestionIndex)) {
      setCompletedQuestions(prev => [...prev, currentQuestionIndex]);
    }

    // Verificar si hay preguntas pospuestas sin completar
    const pendingPostponed = postponedQuestions.filter(idx => !completedQuestions.includes(idx));
    
    // Verificar si estamos en la última pregunta no pospuesta
    const isLastRegularQuestion = currentQuestionIndex === currentQuiz.length - 1 || 
      Array.from({length: currentQuiz.length}).every((_, idx) => 
        idx === currentQuestionIndex || 
        idx > currentQuestionIndex && (completedQuestions.includes(idx) || postponedQuestions.includes(idx))
      );

    // Si estamos en la última pregunta regular y hay preguntas pospuestas pendientes
    if (isLastRegularQuestion && pendingPostponed.length > 0) {
      setCurrentQuestionIndex(pendingPostponed[0]);
      setSelectedAnswer(null);
      setIsChecked(false);
      setIsPostponedModalOpen(true);
      return;
    }
    
    // Si todas las preguntas han sido completadas o pospuestas y luego completadas
    const allCompleted = completedQuestions.length === currentQuiz.length;
    if (allCompleted || pendingPostponed.length === 0) {
      finishQuiz();
      return;
    }
    
    // De lo contrario, ir a la siguiente pregunta no pospuesta
    goToNextNonPostponedQuestion();
  };

  // Reiniciar quiz
  const resetQuiz = () => {
    setSelectedAnswer(null);
    setIsChecked(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setCurrentQuestionIndex(0);
    setCurrentQuiz([]);
    setWrongAnswers([]);
    setIsQuizStarted(false);
    
    // NUEVA FUNCIONALIDAD: Reiniciar estados de preguntas pospuestas
    setPostponedQuestions([]);
    setCompletedQuestions([]);
    setOriginalQuestionOrder([]);

    if (quizState.usedQuestionIds.size >= questions.length - config.numberOfQuestions) {
      setQuizState(prevState => ({
        ...prevState,
        usedQuestionIds: new Set()
      }));
    }
  };

  // Actualizar configuración
  const updateConfig = (field: keyof QuizConfig, value: number) => {
    setConfig(prev => ({
      ...prev,
      [field]: Math.max(
        field === 'numberOfQuestions' ? 1 : 5,
        Math.min(
          value,
          field === 'numberOfQuestions' ? questions.length : 90
        )
      )
    }));
  };

  // NUEVA FUNCIONALIDAD: Calcular el número actual de la pregunta en el orden original
  const getOriginalQuestionNumber = (currentIndex: number) => {
    return originalQuestionOrder.indexOf(currentIndex) + 1;
  };

  // NUEVA FUNCIONALIDAD: Determinar cuántas preguntas han sido completadas y el progreso
  const getProgressInfo = () => {
    const completed = completedQuestions.length;
    const total = currentQuiz.length;
    const current = getOriginalQuestionNumber(currentQuestionIndex);
    const postponed = postponedQuestions.length;
    
    return { completed, total, current, postponed };
  };

  // Renderizar configuración inicial del quiz
  const renderConfig = () => (
    <IonCard>
      <IonCardHeader>
        <IonCardTitle>Configuración del Quiz AWS Cloud Practitioner</IonCardTitle>
      </IonCardHeader>
      <IonCardContent>
        <IonItem>
          <IonLabel position="stacked">Número de Preguntas (máximo {questions.length})</IonLabel>
          <IonInput
            type="number"
            value={config.numberOfQuestions}
            onIonChange={e => updateConfig(
              'numberOfQuestions',
              parseInt(e.detail.value!, 10) || 1
            )}
            min={1}
            max={questions.length}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Tiempo Límite (minutos, máximo 90)</IonLabel>
          <IonInput
            type="number"
            value={config.timeLimit}
            onIonChange={e => updateConfig(
              'timeLimit',
              parseInt(e.detail.value!, 10) || 5
            )}
            min={5}
            max={90}
          />
        </IonItem>

        <div className="ion-padding">
          <IonButton 
            expand="block" 
            onClick={startQuiz}
            disabled={questions.length === 0}
          >
            Iniciar Quiz
          </IonButton>
        </div>
      </IonCardContent>
    </IonCard>
  );

  // Renderizar pregunta actual
  const renderQuestion = () => {
    if (!currentQuiz.length) return null;

    const currentQuestion = currentQuiz[currentQuestionIndex];
    const remainingMinutes = Math.floor(timeLeft / 60);
    const remainingSeconds = timeLeft % 60;
    const { completed, total, current, postponed } = getProgressInfo();

    // NUEVA FUNCIONALIDAD: Mostrar información de progreso mejorada
    return (
      <>
        <div className="ion-margin-bottom">
          <div className="ion-padding ion-margin-bottom" style={{ 
            background: '#f4f5f8', 
            borderRadius: '8px', 
            border: '1px solid #e6e9ed' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {/* NUEVA FUNCIONALIDAD: Mostrar en qué pregunta del examen vas */}
                <p style={{ margin: '0', fontWeight: 'bold' }}>
                  Pregunta {current} de {total}
                  {postponedQuestions.includes(currentQuestionIndex) && 
                    <IonBadge color="warning" style={{ marginLeft: '5px' }}>Pospuesta</IonBadge>
                  }
                </p>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.9em' }}>
                  Completadas: {completed}/{total} 
                  {postponed > 0 && ` • Pospuestas: ${postponed}`}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '0', fontWeight: 'bold' }}>
                  <IonIcon icon={timeOutline} /> {remainingMinutes}:{remainingSeconds.toString().padStart(2, '0')}
                </p>
                <p style={{ margin: '5px 0 0 0', fontSize: '0.9em' }}>
                  <span style={{ color: 'green' }}>
                    <IonIcon icon={checkmarkCircle} color="success" /> {correctCount}
                  </span> • 
                  <span style={{ color: 'red', marginLeft: '5px' }}>
                    <IonIcon icon={closeCircle} color="danger" /> {incorrectCount}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <h2>{currentQuestion.question}</h2>

        <div className="question-options">
          {currentQuestion.type === 'multiple' ? (
            Object.entries(currentQuestion.options).map(([key, value]) => (
              <IonItem key={key}>
                <IonLabel>{key.toUpperCase()}. {value}</IonLabel>
                <IonCheckbox
                  slot="start"
                  checked={Array.isArray(selectedAnswer) && selectedAnswer.includes(key)}
                  onIonChange={() => handleAnswerSelect(key)}
                  disabled={isChecked}
                />
              </IonItem>
            ))
          ) : (
            <IonRadioGroup
              value={selectedAnswer || ''}
              onIonChange={e => handleAnswerSelect(e.detail.value)}
            >
              {Object.entries(currentQuestion.options).map(([key, value]) => (
                <IonItem key={key}>
                  <IonLabel>{key.toUpperCase()}. {value}</IonLabel>
                  <IonRadio slot="start" value={key} disabled={isChecked} />
                </IonItem>
              ))}
            </IonRadioGroup>
          )}
        </div>

        {!isChecked && (
          <div className="ion-margin-top" style={{ display: 'flex', justifyContent: 'space-between' }}>
            {/* NUEVA FUNCIONALIDAD: Botón para posponer pregunta */}
            <IonButton 
              color="warning" 
              onClick={postponeQuestion}
              disabled={postponedQuestions.includes(currentQuestionIndex)}
            >
              <IonIcon icon={helpCircleOutline} slot="start" /> 
              {postponedQuestions.includes(currentQuestionIndex) ? 'Ya pospuesta' : 'Posponer para después'}
            </IonButton>
            
            {selectedAnswer && (
              <IonButton 
                color="primary" 
                onClick={checkAnswer}
              >
                Comprobar
              </IonButton>
            )}
          </div>
        )}

        {isChecked && (
          <div className={`ion-padding ion-margin-top ${isCorrect ? 'ion-color-success' : 'ion-color-danger'}`}>
            <h3>{isCorrect ? 'CORRECTO' : 'INCORRECTO'}</h3>
            <p>Respuesta correcta: {
              currentQuestion.type === 'single'
                ? currentQuestion.options[currentQuestion.answer as string]
                : (currentQuestion.answer as string[])
                    .map(ans => currentQuestion.options[ans])
                    .join(', ')
            }</p>
            <p>{currentQuestion.explanation}</p>
            <IonButton 
              expand="block" 
              color="primary" 
              onClick={nextQuestion}
              className="ion-margin-top"
            >
              Siguiente <IonIcon icon={arrowForward} />
            </IonButton>
          </div>
        )}

        {/* NUEVA FUNCIONALIDAD: Modal de preguntas pospuestas */}
        <IonModal isOpen={isPostponedModalOpen}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Preguntas Pospuestas</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <h2>Preguntas Pospuestas Pendientes</h2>
            <p>Selecciona cuál quieres resolver ahora:</p>
            
            <IonList>
              {postponedQuestions
                .filter(idx => !completedQuestions.includes(idx))
                .map(idx => (
                  <IonItem key={idx} button onClick={() => goToPostponedQuestion(idx)}>
                    <IonLabel>
                      Pregunta {getOriginalQuestionNumber(idx)}: {currentQuiz[idx].question.substring(0, 50)}...
                    </IonLabel>
                  </IonItem>
                ))
              }
            </IonList>
            
            {postponedQuestions.filter(idx => !completedQuestions.includes(idx)).length === 0 && (
              <div className="ion-text-center ion-padding">
                <p>¡Has completado todas las preguntas pospuestas!</p>
                <IonButton onClick={finishQuiz}>Finalizar quiz</IonButton>
              </div>
            )}
            
            <div className="ion-padding ion-text-center">
              <IonButton onClick={() => setIsPostponedModalOpen(false)}>
                Continuar con esta pregunta
              </IonButton>
            </div>
          </IonContent>
        </IonModal>
      </>
    );
  };

  // Renderizar resultados finales
  const renderResults = () => {
    const score = quizState.currentSession.score;
    const totalQuestions = currentQuiz.length;

    return (
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Resultados del Quiz</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <div className="ion-text-center">
            <h1>{score.toFixed(1)}%</h1>
            <h2 className={score >= 70 ? 'ion-color-success' : 'ion-color-danger'}>
              {score >= 70 ? 'APROBADO' : 'NO APROBADO'}
            </h2>
            <p>Preguntas Correctas: {correctCount} de {totalQuestions}</p>
            <p>Necesitas al menos 70% para aprobar el examen AWS Cloud Practitioner</p>
          </div>

          {wrongAnswers.length > 0 && (
            <div className="wrong-answers-section ion-margin-top">
              <h3 className="ion-text-center">Preguntas Incorrectas:</h3>
              {wrongAnswers.map((wrong, index) => (
                <IonCard key={index} className="ion-margin-vertical">
                  <IonCardContent>
                    <p className="ion-margin-bottom">
                      <strong>Pregunta {index + 1}:</strong> {wrong.question.question}
                    </p>
                    
                    <p className="ion-text-danger">
                      <strong>Tu respuesta:</strong> {
                      Array.isArray(wrong.userAnswer) 
                        ? wrong.userAnswer.map(ans => wrong.question.options[ans]).join(', ')
                        : wrong.question.options[wrong.userAnswer as string]
                      }
                    </p>
                    
                    <p className="ion-text-success">
                      <strong>Respuesta correcta:</strong> {
                      Array.isArray(wrong.question.answer)
                        ? wrong.question.answer.map(ans => wrong.question.options[ans]).join(', ')
                        : wrong.question.options[wrong.question.answer as string]
                      }
                    </p>
                    
                    <div className="ion-padding-top">
                      <strong>Explicación:</strong>
                      <p className="ion-text-medium">{wrong.question.explanation}</p>
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </div>
          )}

          <IonButton 
            expand="block" 
            onClick={resetQuiz}
            className="ion-margin-top"
          >
            <IonIcon icon={refreshOutline} slot="start" /> Intentar de Nuevo
          </IonButton>
        </IonCardContent>
      </IonCard>
    );
  };

  // Renderización principal de la aplicación
  return (
    <IonApp>
      <IonHeader>
        <IonToolbar color="aws-primary">
          <IonTitle>Quiz AWS Cloud Practitioner</IonTitle>
        </IonToolbar>
        {isQuizStarted && currentQuiz.length > 0 && (
          <IonProgressBar 
            value={(currentQuestionIndex + 1) / currentQuiz.length}
            color="primary"
          />
        )}
      </IonHeader>
      <IonContent className="ion-padding">
        {loading ? (
          <IonLoading 
            isOpen={true} 
            message="Cargando preguntas..." 
          />
        ) : error ? (
          <IonAlert
            isOpen={true}
            header="Error"
            message={error}
            buttons={['OK']}
          />
        ) : !isQuizStarted && currentQuiz.length > 0 ? (
          renderResults()
        ) : !isQuizStarted ? (
          renderConfig()
        ) : (
          renderQuestion()
        )}
      </IonContent>
    </IonApp>
  );
};

export default App;