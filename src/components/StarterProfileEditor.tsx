import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StarterProfileEditorProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StarterProfileEditor = ({ userId, open, onOpenChange }: StarterProfileEditorProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [ageGroup, setAgeGroup] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && userId) {
      loadProfile();
    }
  }, [open, userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("starter_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfileData(data.profile_data);
        setAgeGroup(data.age_group || "");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar tu perfil",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from("starter_profiles")
        .update({
          profile_data: profileData,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "¡Guardado! ✨",
        description: "Tu perfil ha sido actualizado exitosamente",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar tu perfil",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setProfileData({ ...profileData, [field]: value });
  };

  if (!profileData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Editar Mi Perfil</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No se encontró información de perfil
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">✨ Editar Mi Perfil de Aprendizaje</DialogTitle>
          <DialogDescription>
            Actualiza tu información para que pueda ayudarte mejor
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-200px)] pr-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">📝 Básico</TabsTrigger>
              <TabsTrigger value="learning">🎯 Aprendizaje</TabsTrigger>
              <TabsTrigger value="interests">⭐ Intereses</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="age">Edad</Label>
                <Input
                  id="age"
                  type="number"
                  value={profileData.age || ""}
                  onChange={(e) => updateField("age", parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción Personal</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={profileData.description || ""}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Cuéntame sobre ti..."
                />
              </div>

              {(profileData.uniqueData || profileData.uniqueCharacteristics) && (
                <div className="space-y-2">
                  <Label htmlFor="unique">
                    {ageGroup === "7-12" ? "Datos Interesantes" : "Características Únicas"}
                  </Label>
                  <Textarea
                    id="unique"
                    rows={4}
                    value={profileData.uniqueData || profileData.uniqueCharacteristics || ""}
                    onChange={(e) => {
                      const field = ageGroup === "7-12" ? "uniqueData" : "uniqueCharacteristics";
                      updateField(field, e.target.value);
                    }}
                    placeholder="Algo importante que deba saber..."
                  />
                </div>
              )}

              {profileData.language && (
                <div className="space-y-2">
                  <Label htmlFor="language">Idioma preferido</Label>
                  <Input
                    id="language"
                    value={profileData.language || ""}
                    onChange={(e) => updateField("language", e.target.value)}
                    placeholder="Español, Inglés, Ambos..."
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="learning" className="space-y-4 mt-4">
              {profileData.learningStyle && (
                <div className="space-y-2">
                  <Label htmlFor="learningStyle">Estilo de Aprendizaje</Label>
                  <Input
                    id="learningStyle"
                    value={Array.isArray(profileData.learningStyle) 
                      ? profileData.learningStyle.join(", ")
                      : profileData.learningStyle || ""}
                    onChange={(e) => updateField("learningStyle", e.target.value)}
                    placeholder="Visual, Auditivo, Kinestésico..."
                  />
                </div>
              )}

              {profileData.studyTime && (
                <div className="space-y-2">
                  <Label htmlFor="studyTime">Tiempo de Estudio Preferido</Label>
                  <Input
                    id="studyTime"
                    value={profileData.studyTime || ""}
                    onChange={(e) => updateField("studyTime", e.target.value)}
                    placeholder="Mañana, Tarde, Noche..."
                  />
                </div>
              )}

              {profileData.sessionDuration && (
                <div className="space-y-2">
                  <Label htmlFor="sessionDuration">Duración de Sesión Ideal</Label>
                  <Input
                    id="sessionDuration"
                    value={profileData.sessionDuration || ""}
                    onChange={(e) => updateField("sessionDuration", e.target.value)}
                    placeholder="30 minutos, 1 hora..."
                  />
                </div>
              )}

              {profileData.explanationStyle && (
                <div className="space-y-2">
                  <Label htmlFor="explanationStyle">Estilo de Explicación Preferido</Label>
                  <Input
                    id="explanationStyle"
                    value={Array.isArray(profileData.explanationStyle)
                      ? profileData.explanationStyle.join(", ")
                      : profileData.explanationStyle || ""}
                    onChange={(e) => updateField("explanationStyle", e.target.value)}
                    placeholder="Directo, Detallado, Con ejemplos..."
                  />
                </div>
              )}

              {profileData.communicationStyle && (
                <div className="space-y-2">
                  <Label htmlFor="communicationStyle">Estilo de Comunicación</Label>
                  <Input
                    id="communicationStyle"
                    value={profileData.communicationStyle || ""}
                    onChange={(e) => updateField("communicationStyle", e.target.value)}
                    placeholder="Formal, Informal, Amigable..."
                  />
                </div>
              )}

              {profileData.learningGoal && (
                <div className="space-y-2">
                  <Label htmlFor="learningGoal">Objetivo de Aprendizaje</Label>
                  <Textarea
                    id="learningGoal"
                    rows={3}
                    value={profileData.learningGoal || ""}
                    onChange={(e) => updateField("learningGoal", e.target.value)}
                  />
                </div>
              )}

              {profileData.learningGoals && (
                <div className="space-y-2">
                  <Label htmlFor="learningGoals">Metas de Aprendizaje (6 meses)</Label>
                  <Textarea
                    id="learningGoals"
                    rows={3}
                    value={profileData.learningGoals || ""}
                    onChange={(e) => updateField("learningGoals", e.target.value)}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="interests" className="space-y-4 mt-4">
              {profileData.interests && (
                <div className="space-y-2">
                  <Label htmlFor="interests">Temas de Interés</Label>
                  <Textarea
                    id="interests"
                    rows={3}
                    value={Array.isArray(profileData.interests)
                      ? profileData.interests.join(", ")
                      : profileData.interests || ""}
                    onChange={(e) => updateField("interests", e.target.value)}
                    placeholder="Ciencia, Arte, Deportes..."
                  />
                </div>
              )}

              {profileData.passionateTopics && (
                <div className="space-y-2">
                  <Label htmlFor="passionateTopics">Temas que te Apasionan</Label>
                  <Textarea
                    id="passionateTopics"
                    rows={3}
                    value={Array.isArray(profileData.passionateTopics)
                      ? profileData.passionateTopics.join(", ")
                      : profileData.passionateTopics || ""}
                    onChange={(e) => updateField("passionateTopics", e.target.value)}
                    placeholder="Lo que más te emociona aprender..."
                  />
                </div>
              )}

              {profileData.contentPreference && (
                <div className="space-y-2">
                  <Label htmlFor="contentPreference">Preferencia de Contenido</Label>
                  <Input
                    id="contentPreference"
                    value={Array.isArray(profileData.contentPreference)
                      ? profileData.contentPreference.join(" → ")
                      : profileData.contentPreference || ""}
                    onChange={(e) => updateField("contentPreference", e.target.value)}
                    placeholder="Videos, Textos, Práctica..."
                  />
                </div>
              )}

              {profileData.challenges && (
                <div className="space-y-2">
                  <Label htmlFor="challenges">Enfoque ante Desafíos</Label>
                  <Input
                    id="challenges"
                    value={Array.isArray(profileData.challenges)
                      ? profileData.challenges.join(", ")
                      : profileData.challenges || ""}
                    onChange={(e) => updateField("challenges", e.target.value)}
                    placeholder="Cómo prefieres enfrentar retos..."
                  />
                </div>
              )}

              {profileData.problemApproach && (
                <div className="space-y-2">
                  <Label htmlFor="problemApproach">Enfoque de Resolución de Problemas</Label>
                  <Input
                    id="problemApproach"
                    value={profileData.problemApproach || ""}
                    onChange={(e) => updateField("problemApproach", e.target.value)}
                    placeholder="Paso a paso, Experimental..."
                  />
                </div>
              )}

              {profileData.challengeTolerance && (
                <div className="space-y-2">
                  <Label htmlFor="challengeTolerance">Tolerancia a Desafíos</Label>
                  <Input
                    id="challengeTolerance"
                    value={profileData.challengeTolerance || ""}
                    onChange={(e) => updateField("challengeTolerance", e.target.value)}
                    placeholder="Alta, Media, Baja..."
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Cambios
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};