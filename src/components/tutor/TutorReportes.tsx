import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Calendar, User, ChevronRight, Inbox } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Student {
  id: string;
  name: string;
  email: string;
  starter_completed: boolean;
}

interface Report {
  id: string;
  student_id: string;
  topic: string;
  progress_summary: string | null;
  difficulties: string | null;
  recommendations: string | null;
  emotional_state: string | null;
  daily_observation: string | null;
  created_at: string;
}

interface TutorReportesProps {
  students: Student[];
  tutorId: string;
}

export const TutorReportes = ({ students, tutorId }: TutorReportesProps) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [filterStudent, setFilterStudent] = useState<string>("all");

  useEffect(() => {
    loadReports();

    if (!tutorId) return;

    const channel = supabase
      .channel("tutor-reportes-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tutor_reports", filter: `tutor_id=eq.${tutorId}` }, () => {
        loadReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [students, tutorId]);

  const loadReports = async () => {
    if (!tutorId) {
      setLoading(false);
      return;
    }

    try {
      // Obtener reportes donde el tutor_id coincide con el tutor actual
      const { data, error } = await supabase
        .from("tutor_reports")
        .select("*")
        .eq("tutor_id", tutorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStudentName = (studentId: string) => {
    return students.find(s => s.id === studentId)?.name || "Estudiante";
  };

  const filteredReports = filterStudent === "all" 
    ? reports 
    : reports.filter(r => r.student_id === filterStudent);

  // Agrupar reportes por fecha
  const groupedReports = filteredReports.reduce((acc, report) => {
    const date = format(new Date(report.created_at), "yyyy-MM-dd");
    if (!acc[date]) acc[date] = [];
    acc[date].push(report);
    return acc;
  }, {} as Record<string, Report[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex items-center gap-4">
        <Select value={filterStudent} onValueChange={setFilterStudent}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por alumno" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los alumnos</SelectItem>
            {students.map(student => (
              <SelectItem key={student.id} value={student.id}>
                {student.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista de reportes */}
      {Object.keys(groupedReports).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No hay reportes aún</h3>
            <p className="text-muted-foreground">
              Los reportes se generarán automáticamente cuando los alumnos terminen sus temas de estudio.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedReports).map(([dateStr, dateReports]) => (
            <div key={dateStr} className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm text-muted-foreground">
                  {format(new Date(dateStr), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                </h3>
              </div>
              
              <div className="grid gap-3">
                {dateReports.map(report => (
                  <Card 
                    key={report.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedReport(report)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{report.topic}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{getStudentName(report.student_id)}</span>
                              <span>•</span>
                              <span>{format(new Date(report.created_at), "HH:mm")}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalle del reporte */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Reporte: {selectedReport?.topic}
            </DialogTitle>
          </DialogHeader>
          
          {selectedReport && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b">
                <Badge variant="outline">
                  <User className="h-3 w-3 mr-1" />
                  {getStudentName(selectedReport.student_id)}
                </Badge>
                <Badge variant="outline">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(selectedReport.created_at), "PPpp", { locale: es })}
                </Badge>
              </div>

              {selectedReport.progress_summary && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">Qué avanzó</h4>
                  <p className="text-sm">{selectedReport.progress_summary}</p>
                </div>
              )}

              {selectedReport.difficulties && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">Dificultades encontradas</h4>
                  <p className="text-sm">{selectedReport.difficulties}</p>
                </div>
              )}

              {selectedReport.recommendations && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">Recomendaciones de Sofía</h4>
                  <p className="text-sm">{selectedReport.recommendations}</p>
                </div>
              )}

              {selectedReport.emotional_state && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">Estado emocional</h4>
                  <p className="text-sm">{selectedReport.emotional_state}</p>
                </div>
              )}

              {selectedReport.daily_observation && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">Observación del día</h4>
                  <p className="text-sm">{selectedReport.daily_observation}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};