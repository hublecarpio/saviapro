import { useState, useRef } from "react";

interface UseAudioRecorderProps {
  webhookUrl: string;
  onTranscriptionReceived: (text: string) => void;
}

export const useAudioRecorder = ({ webhookUrl, onTranscriptionReceived }: UseAudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef(false);

  const startRecording = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const mimeType = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const formData = new FormData();
        formData.append("file", blob, `audio.${mimeType === "audio/webm" ? "webm" : "mp4"}`);

        setIsProcessing(true);

        try {
          const res = await fetch(webhookUrl, {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          // Extraer el texto de la respuesta del webhook
          const responseText = 
            data?.response || 
            data?.transcription || 
            data?.respuesta ||
            data?.text ||
            data?.message;

          if (responseText) {
            const cleanText = responseText.trim();
            const lowerText = cleanText.toLowerCase();
            // Filtrar respuestas vacías o placeholders de silencio comunes en Whisper/STT
            if (
              cleanText &&
              !lowerText.includes("[no speech]") &&
              !lowerText.includes("[silencio]") &&
              !lowerText.includes("[blank audio]") &&
              cleanText !== "!" &&
              cleanText !== "." &&
              cleanText !== "¿?"
            ) {
              onTranscriptionReceived(cleanText);
            } else {
              console.log("Audio ignorado (silencio o texto irrelevante):", cleanText);
            }
          } else {
            console.error("No se encontró texto en la respuesta del webhook:", data);
          }
        } catch (err) {
          console.error("Error enviando audio:", err);
        } finally {
          setIsProcessing(false);
        }

        // Limpiar
        chunksRef.current = [];
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      recorder.start(250); // Capturar cada 250ms
      setIsRecording(true);
    } catch (error) {
      console.error("No se pudo acceder al micrófono:", error);
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  return { isRecording, isProcessing, toggleRecording };
};
