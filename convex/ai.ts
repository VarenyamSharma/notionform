"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { getTextExtractor } from "office-text-extractor";

/**
 * Action to extract text from a file based on its type.
 * Supports: .txt, .pdf, .doc, .docx, .ppt, .pptx
 * 
 * Note: Convex actions have a 16 MiB limit for arguments. Since fileContent is base64 encoded
 * (which increases size by ~33%), the maximum original file size should be ~12 MiB.
 * Client-side validation enforces this limit before calling this action.
 */
// export const extractTextFromFile = action({
//   args: {
//     fileContent: v.string(), // Base64 encoded file content (max ~16 MiB after encoding)
//     fileName: v.string(),
//     fileType: v.string(), // MIME type or extension
//   },
//   handler: async (_, { fileContent, fileName, fileType }) => {
//     try {
//       // Convert base64 to buffer
//       const fileBuffer = Buffer.from(fileContent, "base64");

//       // Determine file type from MIME type or file extension
//       const lowerFileName = fileName.toLowerCase();
//       const lowerFileType = (fileType || "").toLowerCase();

//       let extractedText = "";

//       // Handle PDF files
//       if (
//         lowerFileType === "application/pdf" ||
//         lowerFileName.endsWith(".pdf")
//       ) {
//         const pdfData = await (pdfParse.default || pdfParse)(fileBuffer);
//         extractedText = pdfData.text;
//       }
//       // Handle DOCX files
//       else if (
//         lowerFileType ===
//           "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
//         lowerFileName.endsWith(".docx")
//       ) {
//         const result = await mammoth.extractRawText({ buffer: fileBuffer });
//         extractedText = result.value;
//         if (result.messages.length > 0) {
//           console.warn("Mammoth warnings:", result.messages);
//         }
//       }
//       // Handle DOC files (older Word format)
//       else if (
//         lowerFileType === "application/msword" ||
//         lowerFileName.endsWith(".doc")
//       ) {
//         // DOC files are binary format, mammoth doesn't support them directly
//         // We can try to extract or return an error
//         throw new Error(
//           "DOC files (older Word format) are not fully supported. Please convert to DOCX or PDF."
//         );
//       }
//       // Handle PPTX files
//       else if (
//         lowerFileType ===
//           "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
//         lowerFileName.endsWith(".pptx")
//       ) {
//         // Use office-text-extractor for PPTX files
//         const extractor = getTextExtractor();
//         extractedText = await extractor.extractText({
//           input: fileBuffer,
//           type: "buffer",
//         });
//       }
//       // Handle PPT files (older PowerPoint format)
//       else if (
//         lowerFileType ===
//           "application/vnd.ms-powerpoint" ||
//         lowerFileName.endsWith(".ppt")
//       ) {
//         throw new Error(
//           "PPT files (older PowerPoint format) are not fully supported. Please convert to PPTX or PDF."
//         );
//       }
//       // Handle TXT files
//       else if (
//         lowerFileType === "text/plain" ||
//         lowerFileType === ".txt" ||
//         lowerFileType === "txt" ||
//         lowerFileName.endsWith(".txt")
//       ) {
//         extractedText = fileBuffer.toString("utf-8");
//       }
//       // Unsupported file type
//       else {
//         throw new Error(
//           `Unsupported file type: ${fileType}. Supported types: PDF, DOCX, PPTX, TXT`
//         );
//       }

//       if (!extractedText || extractedText.trim().length === 0) {
//         throw new Error(
//           "No text could be extracted from the file. The file might be empty or corrupted."
//         );
//       }

//       return extractedText.trim();
//     } catch (error) {
//       console.error("Error extracting text from file:", error);
//       throw new Error(
//         `Failed to extract text from file: ${
//           error instanceof Error ? error.message : "Unknown error"
//         }`
//       );
//     }
//   },
// });

/**
 * Action to generate a mind map structure from content using the Gemini API.
 * Returns a hierarchical mind map structure with a central topic and branches.
 */
export const generateMindMap = action({
  args: {
    content: v.string(),
  },
  handler: async (_, { content }) => {
    // 1. Get the API key from environment variables.
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set in the environment variables. Please add it to your Convex project configuration."
      );
    }

    // 2. Prepare the request to the Gemini API.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const requestBody = {
      model: "gemini-pro",
      contents: [{
        parts: [{
          text: `Analyze the following content and create a mind map structure. Return ONLY a valid JSON object with this exact structure:
{
  "centralTopic": "Main topic or title",
  "branches": [
    {
      "topic": "Branch topic 1",
      "subtopics": ["Subtopic 1.1", "Subtopic 1.2"]
    },
    {
      "topic": "Branch topic 2",
      "subtopics": ["Subtopic 2.1", "Subtopic 2.2"]
    }
  ]
}

Extract 3-5 main branches from the content, each with 2-4 subtopics. Focus on key concepts, themes, and important points.

Content to analyze:
${content.substring(0, 10000)}`
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topK: 40,
        topP: 0.95
      }
    };

    // 3. Make the API call.
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    // 4. Handle errors from the API.
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate mind map. API response: ${errorText}`);
    }

    // 5. Parse the response and return the mind map.
    const data = await response.json();

    if (!data) {
      throw new Error("Empty response from API");
    }

    // Check for API error messages
    if (data.error) {
      throw new Error(`API Error: ${data.error.message}`);
    }

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No candidates in the API response");
    }

    const candidate = data.candidates[0];
    const candidateContent = candidate.content;
    if (!candidateContent) {
      throw new Error("No content in candidate response");
    }

    // Extract text from content
    let text = "";
    if (candidateContent.parts && candidateContent.parts.length > 0) {
      text = candidateContent.parts[0].text;
    }

    if (!text) {
      throw new Error(`No text found in response. Full candidate structure: ${JSON.stringify(candidate)}`);
    }

    // Parse the JSON response
    try {
      // Clean the text - remove markdown code blocks if present
      const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const mindMap = JSON.parse(cleanedText);

      // Validate the structure
      if (!mindMap.centralTopic || !mindMap.branches || !Array.isArray(mindMap.branches)) {
        throw new Error("Invalid mind map structure received from API");
      }

      return mindMap;
    } catch (parseError) {
      console.error("Error parsing mind map JSON:", parseError);
      console.error("Raw response text:", text);
      throw new Error(`Failed to parse mind map structure: ${parseError instanceof Error ? parseError.message : "Unknown error"}`);
    }
  },
});
