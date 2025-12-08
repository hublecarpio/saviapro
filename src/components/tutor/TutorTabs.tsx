import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, FileText, TrendingUp, BarChart3 } from "lucide-react";
import { TutorResumen } from "./TutorResumen";
import { TutorReportes } from "./TutorReportes";
import { TutorAvance } from "./TutorAvance";
import { TutorEstadisticas } from "./TutorEstadisticas";

interface Student {
  id: string;
  name: string;
  email: string;
  starter_completed: boolean;
}

interface TutorTabsProps {
  students: Student[];
  tutorId: string;
}

export const TutorTabs = ({ students, tutorId }: TutorTabsProps) => {
  return (
    <Tabs defaultValue="resumen" className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="resumen" className="flex items-center gap-2">
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Inicio</span>
        </TabsTrigger>
        <TabsTrigger value="reportes" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Reportes</span>
        </TabsTrigger>
        <TabsTrigger value="avance" className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          <span className="hidden sm:inline">Avance</span>
        </TabsTrigger>
        <TabsTrigger value="estadisticas" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Estadísticas</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="resumen">
        <TutorResumen students={students} tutorId={tutorId} />
      </TabsContent>

      <TabsContent value="reportes">
        <TutorReportes students={students} tutorId={tutorId} />
      </TabsContent>

      <TabsContent value="avance">
        <TutorAvance students={students} tutorId={tutorId} />
      </TabsContent>

      <TabsContent value="estadisticas">
        <TutorEstadisticas students={students} tutorId={tutorId} />
      </TabsContent>
    </Tabs>
  );
};