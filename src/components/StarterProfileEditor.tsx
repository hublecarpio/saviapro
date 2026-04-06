import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Save } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import html2pdf from "html2pdf.js";

import { starterSchema, StarterQuestion } from "@/components/data/starterSchema";

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
  if (!ageGroup || !starterSchema[ageGroup]) {
    return raw;
  }
  
  const normalized: ProfileData = { ...raw };

  for (const q of starterSchema[ageGroup]) {
    // Para preguntas de tipo multiple o ranking, asegurar que sean arrays
    if (q.type === "multiple" || q.type === "ranking") {
      const currentValue = raw[q.id];
      normalized[q.id] = coerceToArray(currentValue);
    }
    // Para otros tipos, mantener el valor tal cual o vacío si no existe
    else if (!(q.id in normalized)) {
      normalized[q.id] = "";
    }
  }

  return normalized;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAnswerForPdf(q: StarterQuestion, raw: unknown): string {
  if (q.type === "number") {
    const v = raw !== undefined && raw !== null && raw !== "" ? String(raw) : "";
    return v ? escapeHtml(v) : "—";
  }
  if (q.type === "textarea") {
    const v = typeof raw === "string" ? raw.trim() : raw != null ? String(raw).trim() : "";
    return v ? `<div style="white-space:pre-wrap;">${escapeHtml(v)}</div>` : "—";
  }
  if (q.type === "single" && q.options) {
    const v = typeof raw === "string" ? raw : "";
    const opt = q.options.find((o) => o.value === v);
    if (opt?.label) return escapeHtml(opt.label);
    return v ? escapeHtml(v) : "—";
  }
  if (q.type === "multiple" && q.options) {
    const arr = coerceToArray(raw);
    if (arr.length === 0) return "—";
    const items = arr
      .map((val) => {
        const opt = q.options!.find((o) => o.value === val);
        return `<li>${escapeHtml(opt?.label ?? val)}</li>`;
      })
      .join("");
    return `<ul style="margin:0;padding-left:18px;">${items}</ul>`;
  }
  if (q.type === "ranking" && q.options) {
    const arr = coerceToArray(raw);
    if (arr.length === 0) return "—";
    const items = arr
      .map((val, i) => {
        const opt = q.options!.find((o) => o.value === val);
        return `<li>${i + 1}. ${escapeHtml(opt?.label ?? val)}</li>`;
      })
      .join("");
    return `<ol style="margin:0;padding-left:18px;">${items}</ol>`;
  }
  const fallback = raw != null && String(raw).trim() ? String(raw) : "";
  return fallback ? escapeHtml(fallback) : "—";
}

function generateStarterPdfHtml(params: {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  ageGroup: AgeGroup;
  profileData: ProfileData;
}): string {
  const { userId, userName, userEmail, ageGroup, profileData } = params;
  const groupLabel =
    ageGroup === "7-12" ? "7 a 12 años" : ageGroup === "12-17" ? "12 a 17 años" : "No definido";
  const normalized =
    ageGroup && starterSchema[ageGroup] ? normalizeProfileData(profileData, ageGroup) : { ...profileData };

  let body = "";

  if (!ageGroup || !starterSchema[ageGroup]) {
    body += `<p style="color:#666;">El perfil no tiene un grupo de edad (7-12 / 12-17) completo. Datos disponibles:</p>`;
    const keys = Object.keys(normalized).sort();
    let any = false;
    for (const key of keys) {
      const val = normalized[key];
      if (val === "" || val == null) continue;
      any = true;
      const display = Array.isArray(val) ? val.join(", ") : String(val);
      body += `<div style="margin-bottom:12px;"><strong>${escapeHtml(key)}</strong><div style="white-space:pre-wrap;margin-top:4px;">${escapeHtml(display)}</div></div>`;
    }
    if (!any) body += "<p>Sin datos para exportar.</p>";
  } else {
    const sections: { title: string; group: StarterQuestion["group"] }[] = [
      { title: "Básico", group: "basic" },
      { title: "Aprendizaje", group: "learning" },
      { title: "Intereses", group: "interests" },
    ];
    for (const sec of sections) {
      const questions = starterSchema[ageGroup].filter((q) => q.group === sec.group);
      if (questions.length === 0) continue;
      body += `<h2 style="color:#333;border-bottom:1px solid #ddd;padding-bottom:8px;margin-top:24px;">${escapeHtml(sec.title)}</h2>`;
      for (const q of questions) {
        const raw = normalized[q.id];
        const answerHtml = formatAnswerForPdf(q, raw);
        body += `
          <div style="margin-bottom:16px;">
            <p style="margin:0 0 4px 0;font-weight:bold;color:#222;">${escapeHtml(q.question)}</p>
            <div style="margin:0;color:#444;line-height:1.5;">${answerHtml}</div>
          </div>`;
      }
    }
  }

  const displayName = userName || userEmail || userId;
  return `
    <div style="font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:24px;border-bottom:2px solid #333;padding-bottom:16px;">
        <h1 style="margin:0;color:#333;">Perfil Starter (formulario inicial)</h1>
        <p style="color:#666;margin-top:10px;">
          <strong>Usuario:</strong> ${escapeHtml(displayName)}<br/>
          ${userEmail ? `<strong>Email:</strong> ${escapeHtml(userEmail)}<br/>` : ""}
          <strong>ID:</strong> ${escapeHtml(userId)}<br/>
          <strong>Grupo de edad:</strong> ${escapeHtml(groupLabel)}<br/>
          <strong>Generado:</strong> ${escapeHtml(new Date().toLocaleString("es-ES"))}
        </p>
      </div>
      ${body}
      <div style="text-align:center;margin-top:40px;padding-top:16px;border-top:1px solid #ddd;color:#999;font-size:11px;">
        SaviaPro · Perfil Starter
      </div>
    </div>
  `;
}

export const StarterProfileEditor = ({ userId, open, onOpenChange }: StarterProfileEditorProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("");
  const [userMeta, setUserMeta] = useState<{ name: string | null; email: string | null }>({
    name: null,
    email: null,
  });
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
      const [{ data, error }, profileRes] = await Promise.all([
        supabase.from("starter_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("name, email").eq("id", userId).maybeSingle(),
      ]);

      if (error) throw error;

      setUserMeta({
        name: profileRes.data?.name ?? null,
        email: profileRes.data?.email ?? null,
      });

      if (data) {
        // Extraer profile_data (contiene todas las respuestas del usuario)
        const rawProfile = (data.profile_data || {}) as ProfileData;

        // Priorizar la edad de la columna age, luego de profile_data
        const ageFromData = data.age ?? rawProfile.age ?? null;
        const parsedAge = typeof ageFromData === 'string' ? parseInt(ageFromData, 10) : ageFromData;
        const cleanAge = (typeof parsedAge === 'number' && !isNaN(parsedAge)) ? parsedAge : null;

        // Inferir grupo de edad
        const inferredGroup: AgeGroup = (data.age_group as AgeGroup) || inferAgeGroupFromAge(cleanAge);

        // Normalizar datos según el grupo de edad
        const normalized = normalizeProfileData(rawProfile, inferredGroup);

        // Combinar todos los datos con la edad
        const finalData = {
          ...normalized,
          age: cleanAge ?? "",
        };

        setProfileData(finalData);
        setAgeGroup(inferredGroup);
      } else {
        // No hay perfil guardado, crear uno nuevo
        setProfileData({
          age: "",
        });
        setAgeGroup("");
      }
    } catch (error) {
      console.error("❌ Error loading profile:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar tu perfil",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadStarterPdf = async () => {
    if (!profileData) return;

    setDownloading(true);
    try {
      const html = generateStarterPdfHtml({
        userId,
        userName: userMeta.name,
        userEmail: userMeta.email,
        ageGroup,
        profileData,
      });
      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.appendChild(container);

      const slug = (userMeta.name || userMeta.email || userId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
      const fileName = `starter_${slug}_${new Date().toISOString().split("T")[0]}.pdf`;

      const opt = {
        margin: 10,
        filename: fileName,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
      };

      await html2pdf().set(opt).from(container).save();
      document.body.removeChild(container);

      toast({
        title: "PDF descargado",
        description: "El perfil Starter se descargó correctamente.",
      });
    } catch (err) {
      console.error("Error generating starter PDF:", err);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = async () => {
    if (!profileData) return;

    try {
      setSaving(true);

      // Parsear edad
      const ageValue = typeof profileData.age === "number" ? profileData.age : parseInt(profileData.age, 10);
      const cleanAge = Number.isNaN(ageValue) ? null : ageValue;

      // Determinar grupo de edad
      const finalAgeGroup: AgeGroup = ageGroup || inferAgeGroupFromAge(cleanAge || undefined);

      // Normalizar datos finales (asegurar arrays para multiple/ranking)
      const finalProfileData = normalizeProfileData(profileData, finalAgeGroup);

      // Upsert en la tabla starter_profiles
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
      console.error("❌ Error saving profile:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar tu perfil. Por favor intenta de nuevo.",
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
            <DialogDescription className="sr-only">
              Cargando editor de perfil de usuario
            </DialogDescription>
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

              {!ageGroup && profileData.age && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    ⚠️ La edad ingresada ({profileData.age}) no está en el rango soportado (7-17 años). 
                    Por favor, ajusta la edad para ver las demás preguntas.
                  </p>
                </div>
              )}

              {!ageGroup && !profileData.age && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    💡 Ingresa tu edad (entre 7 y 17 años) para ver las preguntas personalizadas de tu perfil.
                  </p>
                </div>
              )}

              {ageGroup && basicQuestions.length === 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    No hay preguntas adicionales en esta sección.
                  </p>
                </div>
              )}

              {ageGroup && basicQuestions.map((q) => renderQuestion(q))}
            </TabsContent>

            <TabsContent value="learning" className="space-y-4 mt-4  px-2 md:px-4">
              {!ageGroup && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    💡 Primero indica tu edad en la pestaña <strong>Básico</strong> para configurar tu perfil de aprendizaje.
                  </p>
                </div>
              )}
              {ageGroup && learningQuestions.length === 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    No hay preguntas de aprendizaje para tu grupo de edad.
                  </p>
                </div>
              )}
              {ageGroup && learningQuestions.map((q) => renderQuestion(q))}
            </TabsContent>

            <TabsContent value="interests" className="space-y-4 mt-4  px-2 md:px-4">
              {!ageGroup && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    💡 Primero indica tu edad en la pestaña <strong>Básico</strong> para ver tus intereses.
                  </p>
                </div>
              )}
              {ageGroup && interestsQuestions.length === 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    No hay preguntas de intereses para tu grupo de edad.
                  </p>
                </div>
              )}
              {ageGroup && interestsQuestions.map((q) => renderQuestion(q))}
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={handleDownloadStarterPdf}
            disabled={saving || downloading}
          >
            {downloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando PDF...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Descargar PDF
              </>
            )}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || downloading}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || downloading}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
