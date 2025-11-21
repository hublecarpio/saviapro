import { useState, useEffect, useMemo } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { starterSchema, StarterQuestion } from "@/data/components/starterSchema";

interface StarterProfileEditorProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AgeGroup = "7-12" | "12-17" | "";

type ProfileData = Record<string, any>;

// Helpers
const inferAgeGroupFromAge = (age?: number | null): AgeGroup => {
  if (typeof age !== "number" || Number.isNaN(age)) return "";
  if (age >= 7 && age <= 11) return "7-12";
  if (age >= 12 && age <= 17) return "12-17";
  return "";
};

const coerceToArray = (value: any): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(/,|→/g)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeProfileData = (raw: ProfileData, ageGroup: AgeGroup): ProfileData => {
  if (!ageGroup || !starterSchema[ageGroup]) return raw;
  const normalized: ProfileData = { ...raw };

  for (const q of starterSchema[ageGroup]) {
    if (q.type === "multiple" || q.type === "ranking") {
      normalized[q.id] = coerceToArray(raw[q.id]);
    }
  }

  return normalized;
};

export const StarterProfileEditor = ({ userId, open, onOpenChange }: StarterProfileEditorProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && userId) {
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("starter_profiles").select("*").eq("user_id", userId).maybeSingle();

      if (error) throw error;

      if (data) {
        const rawProfile = (data.profile_data || {}) as ProfileData;

        const ageFromRow: number | undefined = data.age ?? rawProfile.age ?? undefined;

        const inferredGroup: AgeGroup = (data.age_group as AgeGroup) || inferAgeGroupFromAge(ageFromRow);

        const normalized = normalizeProfileData(rawProfile, inferredGroup);

        setProfileData({
          ...normalized,
          age: ageFromRow ?? normalized.age ?? "",
        });
        setAgeGroup(inferredGroup);
      } else {
        // Perfil vacío por defecto
        setProfileData({
          age: "",
        });
        setAgeGroup("");
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
    if (!profileData) return;

    try {
      setSaving(true);

      const ageValue = typeof profileData.age === "number" ? profileData.age : parseInt(profileData.age, 10);

      const cleanAge = Number.isNaN(ageValue) ? null : ageValue;

      // Normalizamos por última vez antes de guardar
      const finalAgeGroup: AgeGroup = ageGroup || inferAgeGroupFromAge(cleanAge || undefined);

      const finalProfileData = normalizeProfileData(profileData, finalAgeGroup);

      const { error } = await supabase.from("starter_profiles").upsert(
        {
          user_id: userId,
          age: cleanAge,
          age_group: finalAgeGroup || null,
          profile_data: finalProfileData,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

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
    setProfileData((prev) => ({
      ...(prev || {}),
      [field]: value,
    }));
  };

  const handleAgeChange = (value: string) => {
    const age = parseInt(value, 10);
    updateField("age", value === "" ? "" : age);

    const group = inferAgeGroupFromAge(age);
    setAgeGroup(group);

    if (profileData && group) {
      setProfileData((prev) => normalizeProfileData(prev || {}, group));
    }
  };

  const questionsForGroup = useMemo<StarterQuestion[]>(() => {
    if (!ageGroup || !starterSchema[ageGroup]) return [];
    return starterSchema[ageGroup];
  }, [ageGroup]);

  const basicQuestions = useMemo(
    () => questionsForGroup.filter((q) => q.group === "basic" && q.id !== "age"),
    [questionsForGroup],
  );

  const learningQuestions = useMemo(() => questionsForGroup.filter((q) => q.group === "learning"), [questionsForGroup]);

  const interestsQuestions = useMemo(
    () => questionsForGroup.filter((q) => q.group === "interests"),
    [questionsForGroup],
  );

  const getValue = (id: string): any => {
    if (!profileData) return "";
    return profileData[id] ?? "";
  };

  const getArrayValue = (id: string): string[] => {
    const raw = getValue(id);
    return coerceToArray(raw);
  };

  const toggleMultipleOption = (id: string, value: string, max?: number) => {
    const current = getArrayValue(id);
    if (current.includes(value)) {
      updateField(
        id,
        current.filter((v) => v !== value),
      );
    } else {
      if (max && current.length >= max) return;
      updateField(id, [...current, value]);
    }
  };

  const toggleRankingOption = (id: string, value: string) => {
    const current = getArrayValue(id);
    if (current.includes(value)) {
      updateField(
        id,
        current.filter((v) => v !== value),
      );
    } else {
      updateField(id, [...current, value]);
    }
  };

  const renderQuestion = (q: StarterQuestion) => {
    const value = getValue(q.id);

    // Numero (edad u otros)
    if (q.type === "number") {
      return (
        <div className="space-y-2" key={q.id}>
          <Label htmlFor={q.id}>Edad</Label>
          <Input
            id={q.id}
            type="number"
            value={value === "" ? "" : value}
            onChange={(e) => handleAgeChange(e.target.value)}
            min={7}
            max={17}
          />
          {ageGroup && (
            <p className="text-xs text-muted-foreground">
              Grupo actual: {ageGroup === "7-12" ? "7 a 12 años" : "12 a 17 años"}
            </p>
          )}
        </div>
      );
    }

    // Textarea
    if (q.type === "textarea") {
      return (
        <div className="space-y-2" key={q.id}>
          <Label htmlFor={q.id}>{q.question}</Label>
          <Textarea
            id={q.id}
            rows={4}
            value={value || ""}
            onChange={(e) => updateField(q.id, e.target.value)}
            placeholder={q.placeholder}
          />
        </div>
      );
    }

    // Single (Select de shadcn)
    if (q.type === "single" && q.options) {
      const currentValue = typeof value === "string" ? value : "";
      return (
        <div className="space-y-2" key={q.id}>
          <Label>{q.question}</Label>
          <Select value={currentValue || undefined} onValueChange={(val) => updateField(q.id, val)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona una opción" />
            </SelectTrigger>
            <SelectContent>
              {q.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Multiple (chips toggles)
    if (q.type === "multiple" && q.options) {
      const selected = getArrayValue(q.id);
      return (
        <div className="space-y-2" key={q.id}>
          <Label>{q.question}</Label>
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt) => {
              const isSelected = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleMultipleOption(q.id, opt.value, q.max)}
                  className={`px-3 py-1 rounded-full border text-sm transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Seleccionadas: {selected.length}
            {q.max ? ` / ${q.max}` : null}
          </p>
        </div>
      );
    }

    // Ranking (mismo UX que Starter: clic = orden)
    if (q.type === "ranking" && q.options) {
      const selected = getArrayValue(q.id);
      return (
        <div className="space-y-2" key={q.id}>
          <Label>{q.question}</Label>
          <div className="space-y-3">
            {q.options.map((opt) => {
              const idx = selected.indexOf(opt.value);
              const isSelected = idx !== -1;
              const displayRank = isSelected ? idx + 1 : "#";
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleRankingOption(q.id, opt.value)}
                  className={`w-full flex items-center gap-4 p-3 rounded-lg border text-left text-sm transition-all ${
                    isSelected ? "bg-primary/10 border-primary" : "bg-background border-border hover:bg-accent"
                  }`}
                >
                  <div
                    className={`w-10 h-10 flex items-center justify-center rounded-md font-bold border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {displayRank}
                  </div>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Haz clic para asignar o quitar el orden de preferencia.</p>
        </div>
      );
    }

    // Fallback (por si agregas algo nuevo en el futuro)
    return (
      <div className="space-y-2" key={q.id}>
        <Label htmlFor={q.id}>{q.question}</Label>
        <Input id={q.id} value={value || ""} onChange={(e) => updateField(q.id, e.target.value)} />
      </div>
    );
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Editar Mi Perfil</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!profileData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">✨ Editar Mi Perfil de Aprendizaje</DialogTitle>
          <DialogDescription>Actualiza tu información para que pueda ayudarte mejor</DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-200px)] pr-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">📝 Básico</TabsTrigger>
              <TabsTrigger value="learning">🎯 Aprendizaje</TabsTrigger>
              <TabsTrigger value="interests">⭐ Intereses</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4  px-2 md:px-4">
              {/* Edad (siempre visible) */}
              {renderQuestion({
                id: "age",
                question: "Edad",
                type: "number",
                group: "basic",
              } as StarterQuestion)}

              {!ageGroup && (
                <p className="text-xs text-muted-foreground">
                  Completa tu edad para ver las demás preguntas de tu grupo.
                </p>
              )}

              {ageGroup && basicQuestions.map((q) => renderQuestion(q))}
            </TabsContent>

            <TabsContent value="learning" className="space-y-4 mt-4  px-2 md:px-4">
              {!ageGroup && (
                <p className="text-sm text-muted-foreground">
                  Primero indica tu edad en la pestaña Básico para configurar tu perfil.
                </p>
              )}
              {ageGroup && learningQuestions.map((q) => renderQuestion(q))}
            </TabsContent>

            <TabsContent value="interests" className="space-y-4 mt-4  px-2 md:px-4">
              {!ageGroup && (
                <p className="text-sm text-muted-foreground">Primero indica tu edad en la pestaña Básico.</p>
              )}
              {ageGroup && interestsQuestions.map((q) => renderQuestion(q))}
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
