"use client";

import { useState, useCallback, useEffect } from "react";
import { useAddSourceModal } from "@/hooks/use-add-source-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { UploaderProvider, useUploader, formatFileSize } from "../upload/uploader-provider";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { FileIcon, Trash, UploadCloud } from "lucide-react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type MindMapBranch = {
  topic: string;
  subtopics: string[];
};

type GeneratedMindMap = {
  source: string;
  centralTopic: string;
  branches: MindMapBranch[];
};

const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "text/plain": [".txt"],
};

// Maximum file size: 12 MiB (to account for base64 encoding overhead ~33%, keeping under 16 MiB Convex limit)
const MAX_FILE_SIZE = 12 * 1024 * 1024; // 12 MiB

interface FileUploadAreaProps {
  onMindMapsChange: (mindMaps: GeneratedMindMap[]) => void;
}

const FileUploadArea = ({ onMindMapsChange }: FileUploadAreaProps) => {
  const { fileStates, addFiles, removeFile } = useUploader();
  const [generatingKeys, setGeneratingKeys] = useState<Set<string>>(new Set());
  const [generatedMindMaps, setGeneratedMindMaps] = useState<GeneratedMindMap[]>([]);
  const generateMindMap = useAction(api.ai.generateMindMap);
  const extractText = useAction(api.ai.extractTextFromFile);

  // Notify parent when mind maps change
  useEffect(() => {
    onMindMapsChange(generatedMindMaps);
  }, [generatedMindMaps, onMindMapsChange]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // Filter out files that are too large
      const validFiles: File[] = [];
      const rejectedFiles: File[] = [];

      acceptedFiles.forEach((file) => {
        if (file.size > MAX_FILE_SIZE) {
          rejectedFiles.push(file);
        } else {
          validFiles.push(file);
        }
      });

      // Show error for rejected files
      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach((file) => {
          toast.error(
            `File "${file.name}" is too large. Maximum file size is ${formatFileSize(MAX_FILE_SIZE)}.`
          );
        });
      }

      // Add only valid files
      if (validFiles.length > 0) {
        addFiles(validFiles);
      }
    },
    [addFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    multiple: true,
  });

  // Convert file to base64
  const fileToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleGenerate = async (fileState: { file: File; key: string }) => {
    const { file, key } = fileState;
    
    // Check if already generated
    if (generatedMindMaps.some((mindMap) => mindMap.source === file.name)) {
      toast.info("Mind map already generated for this file");
      return;
    }

    // Additional safety check for file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `File "${file.name}" is too large. Maximum file size is ${formatFileSize(MAX_FILE_SIZE)}.`
      );
      return;
    }

    setGeneratingKeys((prev) => new Set(prev).add(key));

    try {
      // Convert file to base64
      const base64Content = await fileToBase64(file);

      // Extract text using the server action
      const textContent = await extractText({
        fileContent: base64Content,
        fileName: file.name,
        fileType: file.type || file.name.split(".").pop() || "",
      });

      if (!textContent || textContent.trim() === "") {
        toast.error("File is empty or could not be read");
        setGeneratingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        return;
      }

      // Generate mind map using AI
      const mindMapData = await generateMindMap({ content: textContent });

      // Add to generated mind maps
      const newMindMaps = [
        ...generatedMindMaps,
        { source: file.name, ...mindMapData },
      ];
      setGeneratedMindMaps(newMindMaps);
      onMindMapsChange(newMindMaps);

      toast.success("Mind map generated successfully!");
    } catch (error) {
      console.error("Error generating mind map:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate mind map. Please try again."
      );
    } finally {
      setGeneratingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleRemoveGeneratedMindMap = (source: string) => {
    const newMindMaps = generatedMindMaps.filter((mindMap) => mindMap.source !== source);
    setGeneratedMindMaps(newMindMaps);
    onMindMapsChange(newMindMaps);
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/50 hover:border-muted-foreground"
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag & drop files here, or click to select
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports: .txt, .pdf, .doc, .docx, .ppt, .pptx
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Max file size: {formatFileSize(MAX_FILE_SIZE)}
        </p>
      </div>

      {/* File List */}
      {fileStates.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Uploaded Files</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {fileStates.map((fileState) => {
              const isGenerating = generatingKeys.has(fileState.key);
              const isGenerated = generatedMindMaps.some(
                (mindMap) => mindMap.source === fileState.file.name
              );

              return (
                <div
                  key={fileState.key}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {fileState.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(fileState.file.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isGenerated && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerate(fileState)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? "Generating..." : "Generate Mind Map"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        removeFile(fileState.key);
                        handleRemoveGeneratedMindMap(fileState.file.name);
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Generated Mind Maps */}
      {(generatedMindMaps.length > 0 || generatingKeys.size > 0) && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Generated Mind Maps</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {generatingKeys.size > 0 && generatedMindMaps.length === 0 && (
              <div className="space-y-2">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            )}
            {generatedMindMaps.map((mindMap, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg space-y-3 bg-muted/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold mb-2">{mindMap.centralTopic}</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Source: {mindMap.source}
                    </p>
                    <div className="space-y-2">
                      {mindMap.branches.map((branch, branchIndex) => (
                        <div key={branchIndex} className="pl-2 border-l-2 border-primary/20">
                          <p className="text-sm font-medium mb-1">{branch.topic}</p>
                          <ul className="text-xs text-muted-foreground space-y-0.5 ml-2">
                            {branch.subtopics.map((subtopic, subIndex) => (
                              <li key={subIndex}>• {subtopic}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveGeneratedMindMap(mindMap.source)}
                    className="h-8 w-8 p-0 shrink-0"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const AddSourceModal = () => {
  const { isOpen, onClose } = useAddSourceModal();
  const [mindMapTitle, setMindMapTitle] = useState("");
  const [generatedMindMaps, setGeneratedMindMaps] = useState<GeneratedMindMap[]>([]);
  const [uploaderKey, setUploaderKey] = useState(0); // Key to force remount UploaderProvider
  const create = useMutation(api.forms.create);
  const update = useMutation(api.forms.update);
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // Mock upload function for UploaderProvider (we don't actually need to upload files to storage)
  const mockUploadFn = async ({ file }: { file: File }) => {
    // We don't need to upload files, just keep them in memory
    return { url: URL.createObjectURL(file) };
  };

  const handleSave = async () => {
    if (!mindMapTitle.trim()) {
      toast.error("Please enter a mind map title");
      return;
    }

    if (generatedMindMaps.length === 0) {
      toast.error("No generated mind maps to save");
      return;
    }

    setIsSaving(true);
    try {
      // Combine all mind maps into a structured format
      const combinedContent = generatedMindMaps
        .map((mindMap) => {
          let content = `# ${mindMap.centralTopic}\n\nSource: ${mindMap.source}\n\n`;
          mindMap.branches.forEach((branch) => {
            content += `## ${branch.topic}\n\n`;
            branch.subtopics.forEach((subtopic) => {
              content += `- ${subtopic}\n`;
            });
            content += "\n";
          });
          return content;
        })
        .join("\n---\n\n");

      // Create the document
      const documentId = await create({
        title: mindMapTitle || "Untitled Mind Map",
      });

      // Create BlockNote document structure
      // Split content into paragraphs and create blocks with IDs
      const lines = combinedContent.split("\n").filter((line) => line.trim());
      const blocks = lines.map((line, index) => {
        const isHeading1 = line.startsWith("# ");
        const isHeading2 = line.startsWith("## ");
        const isListItem = line.startsWith("- ");
        
        return {
          id: `block-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
          type: (isHeading1 ? "heading" : isHeading2 ? "heading" : "paragraph") as const,
          props: {
            textColor: "default",
            backgroundColor: "default",
            textAlignment: "left",
            level: isHeading1 ? 1 : isHeading2 ? 2 : undefined,
          },
          content: [
            {
              type: "text",
              text: line.replace(/^#+\s*/, "").replace(/^-\s*/, "").trim(),
              styles: isHeading1 || isHeading2 ? { bold: true } : {},
            },
          ],
          children: [],
        };
      });

      // Update the document with the combined content
      await update({
        id: documentId,
        content: JSON.stringify(blocks),
      });

      toast.success("Mind map created!");
      handleClose();
      router.push(`/forms/${documentId}`);
    } catch (error) {
      console.error("Error saving mind map:", error);
      toast.error("Failed to save mind map. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setMindMapTitle("");
    setGeneratedMindMaps([]);
    setUploaderKey((prev) => prev + 1); // Force remount UploaderProvider to reset state
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Mind Map from Source</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Mind Map Title
            </label>
            <Input
              placeholder="Enter mind map title..."
              value={mindMapTitle}
              onChange={(e) => setMindMapTitle(e.target.value)}
            />
          </div>

          <UploaderProvider key={uploaderKey} uploadFn={mockUploadFn} autoUpload={false}>
            <FileUploadArea onMindMapsChange={setGeneratedMindMaps} />
          </UploaderProvider>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || generatedMindMaps.length === 0}>
            {isSaving ? "Saving..." : "Save Mind Map"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

