import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  upload_mode: string;
  created_at: string;
}
interface DocumentsListProps {
  refreshTrigger?: number;
  source: "educational" | "pedagogical";
}

export const DocumentsList = ({ refreshTrigger = 0, source }: DocumentsListProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadDocuments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      console.log(`[DocumentsList] Loading documents. source=${source}`);

      if (source === "pedagogical") {
        const { data, error } = await supabase
          .from("pedagogical_docs")
          .select("id, title, category, is_active, metadata, created_at")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const mapped = (data || []).map(doc => ({
          id: doc.id,
          file_name: doc.title,
          file_type: (doc.metadata as any)?.file_type || "text/plain",
          upload_mode: doc.category,
          created_at: doc.created_at,
        }));
        setDocuments(mapped);
        console.log(`[DocumentsList] Loaded ${mapped.length} pedagogical docs`);
      } else {
        const { data, error } = await supabase
          .from("uploaded_documents")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setDocuments(data || []);
        console.log(`[DocumentsList] Loaded ${(data || []).length} educational docs`);
      }
    } catch (error) {
      console.error(`[DocumentsList] ❌ Error loading (source=${source}):`, error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los documentos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const previousDocs = documents;
      setDocuments(prev => prev.filter(doc => doc.id !== id));

      console.log(`[DocumentsList] Deleting document. source=${source}, id=${id}`);

      if (source === "pedagogical") {
        const { error } = await supabase
          .from("pedagogical_docs")
          .delete()
          .eq("id", id);

        if (error) {
          setDocuments(previousDocs);
          throw error;
        }
        console.log(`[DocumentsList] ✅ Deleted pedagogical doc: ${id}`);
        toast({
          title: "Documento eliminado",
          description: "El documento pedagógico fue eliminado",
        });
      } else {
        const { error: embError } = await supabase
          .from("document_embeddings")
          .delete()
          .eq("document_id", id);
        if (embError) console.warn("Error deleting embeddings:", embError);

        const { error } = await supabase
          .from("uploaded_documents")
          .delete()
          .eq("id", id);

        if (error) {
          setDocuments(previousDocs);
          throw error;
        }
        console.log(`[DocumentsList] ✅ Deleted educational doc + embeddings: ${id}`);
        toast({
          title: "Documento eliminado",
          description: "El documento y sus embeddings fueron eliminados",
        });
      }
    } catch (error) {
      console.error(`[DocumentsList] ❌ Delete error (source=${source}):`, error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el documento",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadDocuments();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const tableName = source === "pedagogical" ? "pedagogical_docs" : "uploaded_documents";
    const channelName = `documents-changes-${source}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
        },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            console.log(`[DocumentsList] Realtime change detected on ${tableName}, reloading...`);
            loadDocuments();
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [refreshTrigger]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">Cargando documentos...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{source === "pedagogical" ? "Documentos Pedagógicos Subidos" : "Documentos Educativos Subidos"}</CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {source === "pedagogical" ? "No hay documentos pedagógicos subidos" : "No hay documentos educativos subidos"}
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {doc.upload_mode === "text" ? (
                    <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  ) : (
                    <File className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {source === "pedagogical"
                        ? `Categoría: ${doc.upload_mode}`
                        : doc.upload_mode === "text" ? "Texto pegado" : "Archivo subido"}{" • "}
                      {format(new Date(doc.created_at), "PPp", { locale: es })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(doc.id)}
                  className="flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
