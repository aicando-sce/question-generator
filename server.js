import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

// Claude API 키는 환경변수로 설정
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

app.post("/upload", upload.array("pdfs"), async (req, res) => {
  try {
    let results = [];

    for (const file of req.files) {
      // PDF 텍스트 추출
      const data = await pdfParse(file.buffer);
      const text = data.text;

      // 파일명에서 개념유닛코드 추출
      const codeMatch = file.originalname.match(/22SCE\d+/);
      const code = codeMatch ? codeMatch[0] : "UNKNOWN";

      // Claude API 호출
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": CLAUDE_API_KEY
        },
        body: JSON.stringify({
          model: "claude-3-opus-20240229",
          max_tokens: 1200,
          messages: [
            {
              role: "user",
              content: `다음 PDF 텍스트를 기반으로 편집 매뉴얼을 준수한 초등 단원평가 문항을 생성해줘.
              PDF 내용: ${text}
              출력 형식은 반드시 JSON으로:
              {
                "code": "${code}",
                "meta": "...",
                "text": "...",
                "options": ["① ...", "② ...", "③ ...", "④ ...", "⑤ ..."],
                "answer": "(정답)②",
                "explanation": "(해설)..."
              }`
            }
          ]
        })
      });

      const result = await response.json();
      const content = result.content[0].text;
      const question = JSON.parse(content);

      results.push(question);
    }

    // 개념유닛코드 기준 정렬
    results.sort((a, b) => a.code.localeCompare(b.code));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send("PDF 처리 오류");
  }
});

app.listen(3000, () => console.log("서버 실행 중 http://localhost:3000"));
