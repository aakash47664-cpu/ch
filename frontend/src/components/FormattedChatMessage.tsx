import React, { useState } from 'react';
import katex from 'katex';
import { Copy, Check } from 'lucide-react';

interface FormattedChatMessageProps {
  text: string;
  isAi?: boolean;
}

interface TableBlock {
  type: 'table';
  headers: string[];
  alignments: ('left' | 'center' | 'right')[];
  rows: string[][];
}

interface CodeBlock {
  type: 'code';
  lang: string;
  code: string;
}

interface MathBlock {
  type: 'math_block';
  math: string;
}

interface HeadingBlock {
  type: 'heading';
  text: string;
}

interface BulletBlock {
  type: 'bullet';
  text: string;
}

interface NumberedBlock {
  type: 'numbered';
  num: string;
  text: string;
}

interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

interface EmptyBlock {
  type: 'empty';
}

type MessageBlock =
  | TableBlock
  | CodeBlock
  | MathBlock
  | HeadingBlock
  | BulletBlock
  | NumberedBlock
  | ParagraphBlock
  | EmptyBlock;

/**
 * Safely renders LaTeX string into KaTeX HTML.
 * Never throws an error; returns fallback if KaTeX fails.
 */
function renderKaTeX(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      errorColor: '#dc2626',
      output: 'htmlAndMathml',
      strict: false
    });
  } catch (err) {
    console.warn('KaTeX render error:', err);
    return `<span class="katex-fallback">${tex}</span>`;
  }
}

/**
 * Parses raw message text into structured blocks (Equations, Tables, Code, Headings, Lists, Paragraphs).
 */
function parseMessageBlocks(rawText: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim() || 'CALCULATION';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') });
      continue;
    }

    // 2. Display Math: $$ ... $$ (Single line or Multi-line)
    if (trimmed.startsWith('$$')) {
      const remainder = trimmed.slice(2);
      if (remainder.endsWith('$$') && remainder.length > 2) {
        // Single line $$ ... $$
        const math = remainder.slice(0, -2).trim();
        blocks.push({ type: 'math_block', math });
        i++;
        continue;
      } else {
        // Multi-line $$ ... $$
        const mathLines = remainder ? [remainder] : [];
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          const lastLine = lines[i].trim();
          const mathEnd = lastLine.slice(0, -2).trim();
          if (mathEnd) mathLines.push(mathEnd);
          i++;
        }
        blocks.push({ type: 'math_block', math: mathLines.join('\n').trim() });
        continue;
      }
    }

    // 3. Display Math: \[ ... \] (Single line or Multi-line)
    if (trimmed.startsWith('\\[') || trimmed.startsWith('$$')) {
      // Checked
    }

    // 4. Single line containing exact $$...$$
    const singleLineMatch = trimmed.match(/^\$\$([\s\S]+?)\$\$$/);
    if (singleLineMatch) {
      blocks.push({ type: 'math_block', math: singleLineMatch[1].trim() });
      i++;
      continue;
    }

    // 5. Unenclosed LaTeX equation on its own line (e.g. "v = \frac{...}{...}" or "A = \frac{\pi ...}{4}")
    // Ensures raw LaTeX commands like \frac, \text{}, \begin{aligned} are NEVER shown as plain text.
    if (
      (trimmed.includes('\\frac{') ||
        trimmed.includes('\\sqrt{') ||
        trimmed.includes('\\begin{aligned}') ||
        trimmed.includes('\\int_') ||
        trimmed.includes('\\sum_')) &&
      !trimmed.startsWith('|') &&
      !trimmed.startsWith('#')
    ) {
      // Remove accidental leading/trailing dollar signs or backslashes
      const cleanMath = trimmed.replace(/^(\$\$|\$|\\\[)/, '').replace(/(\$\$|\$|\\\])$/, '').trim();
      blocks.push({ type: 'math_block', math: cleanMath });
      i++;
      continue;
    }

    // 6. Markdown Table: Consecutive lines with '|'
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2 && tableLines[1].includes('---')) {
        const parseRow = (r: string) =>
          r
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
        const headers = parseRow(tableLines[0]);
        const alignments = parseRow(tableLines[1]).map((c) => {
          if (c.startsWith(':') && c.endsWith(':')) return 'center' as const;
          if (c.endsWith(':')) return 'right' as const;
          return 'left' as const;
        });
        const rows = tableLines.slice(2).map(parseRow);
        blocks.push({ type: 'table', headers, alignments, rows });
        continue;
      } else {
        tableLines.forEach((tl) => blocks.push({ type: 'paragraph', text: tl }));
        continue;
      }
    }

    // 7. Section Headings
    if (
      trimmed.startsWith('#') ||
      trimmed.startsWith('CURRENT PROCESS STATUS:') ||
      trimmed.startsWith('RECOMMENDED') ||
      trimmed.startsWith('SEVERITY ASSESSMENT:') ||
      trimmed.startsWith('Evidence:') ||
      trimmed.startsWith('Probable Root Cause:') ||
      trimmed.startsWith('Why AI Diagnosed This:') ||
      trimmed.startsWith('Action:') ||
      trimmed.startsWith('FAULT PROGRESSION') ||
      trimmed.startsWith('WHY DID AI DETECT THIS?') ||
      trimmed.startsWith('PREVENTIVE RISK SCORE:') ||
      trimmed.startsWith('CHEMDIAG DIGITAL TWIN') ||
      trimmed.startsWith('ENGINEERING CALCULATION') ||
      trimmed.startsWith('PUMP CAVITATION') ||
      trimmed.startsWith('DYNAMIC COMPRESSORS') ||
      trimmed.startsWith('PROCESS CONTROL') ||
      trimmed.startsWith('DISTILLATION TRAY') ||
      trimmed.startsWith('CHEMICAL REACTOR') ||
      trimmed.startsWith('HEAT EXCHANGER') ||
      trimmed.startsWith('PROCESS SAFETY') ||
      trimmed.startsWith('HYDRAULIC ANALYSIS')
    ) {
      blocks.push({ type: 'heading', text: trimmed.replace(/^#+\s*/, '') });
      i++;
      continue;
    }

    // 8. Bullet list
    if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.replace(/^[•\-*]\s*/, '');
      blocks.push({ type: 'bullet', text: content });
      i++;
      continue;
    }

    // 9. Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      blocks.push({ type: 'numbered', num: numberedMatch[1], text: numberedMatch[2] });
      i++;
      continue;
    }

    // 10. Empty line
    if (trimmed === '') {
      blocks.push({ type: 'empty' });
      i++;
      continue;
    }

    // 11. Regular paragraph line
    blocks.push({ type: 'paragraph', text: line });
    i++;
  }

  return blocks;
}

/**
 * Tokenizes and formats inline text:
 * - Math: $ ... $, \( ... \), or raw \frac / LaTeX formulas
 * - Code: `...`
 * - Bold: **...**
 * - Italic: *...*
 * - Engineering units and numerical values: e.g. 25.0 m³/h, 1.572 m/s, 0.004418 m², 101.3 kPa, 850 kg/m³, 4.184 kJ/(kg·K), 150 °C
 */
function renderInlineContent(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  // Master regex matching inline constructs in order of specificity
  const regex = /(\$[^$\n]+\$|\\\([^)\n]+\\\)|`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|(?:\b[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?\s*(?:m²|m³|m\/s|m³\/h|m³\/s|kg\/m³|kJ\/\(kg·K\)|kJ\/kg·K|kJ\/kg|kJ|J|W|kW|MW|kPa|bar|barg|psi|psig|°C|°F|K|RPM|rpm|cP|mPa·s|mPa\.s|mm|cm|m|s|min|h|hr|%)(?=$|[\s,;.)\]]))|(?:\b[0-9]+\.[0-9]{3,}\b)|\\frac\{[^{}]+\}\{[^{}]+\})/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(
        <span key={`txt-${keyIndex++}`}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }

    const val = match[0];

    if (val.startsWith('$') && val.endsWith('$')) {
      const math = val.slice(1, -1);
      elements.push(
        <span
          key={`math-${keyIndex++}`}
          className="math-inline"
          dangerouslySetInnerHTML={{ __html: renderKaTeX(math, false) }}
        />
      );
    } else if (val.startsWith('\\(') && val.endsWith('\\)')) {
      const math = val.slice(2, -2);
      elements.push(
        <span
          key={`math-${keyIndex++}`}
          className="math-inline"
          dangerouslySetInnerHTML={{ __html: renderKaTeX(math, false) }}
        />
      );
    } else if (val.startsWith('\\frac')) {
      elements.push(
        <span
          key={`math-${keyIndex++}`}
          className="math-inline"
          dangerouslySetInnerHTML={{ __html: renderKaTeX(val, false) }}
        />
      );
    } else if (val.startsWith('`') && val.endsWith('`')) {
      elements.push(
        <code key={`code-${keyIndex++}`} className="chat-inline-code">
          {val.slice(1, -1)}
        </code>
      );
    } else if ((val.startsWith('**') && val.endsWith('**')) || (val.startsWith('__') && val.endsWith('__'))) {
      elements.push(
        <strong key={`bold-${keyIndex++}`}>
          {val.slice(2, -2)}
        </strong>
      );
    } else {
      // Engineering numerical value and unit
      elements.push(
        <span key={`eng-${keyIndex++}`} className="eng-num-unit">
          {val}
        </span>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(
      <span key={`txt-${keyIndex++}`}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  return elements;
}

/**
 * Copyable Code Block component
 */
const CodeBlockView: React.FC<{ lang: string; code: string }> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="chat-code-block-wrapper">
      <div className="chat-code-header">
        <span>{lang || 'CALCULATION'}</span>
        <button
          className="chat-code-copy-btn"
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          <span>{copied ? 'COPIED' : 'COPY'}</span>
        </button>
      </div>
      <pre className="chat-code-block">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/**
 * Display Math Card component
 */
const DisplayMathCard: React.FC<{ math: string }> = ({ math }) => {
  const renderedHtml = renderKaTeX(math, true);

  return (
    <div className="math-display-card">
      <div className="math-card-header">
        <span>Engineering Equation</span>
      </div>
      <div
        className="math-display-scroll"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
};

/**
 * Markdown Table component
 */
const MarkdownTableView: React.FC<{
  headers: string[];
  alignments: ('left' | 'center' | 'right')[];
  rows: string[][];
}> = ({ headers, alignments, rows }) => {
  const isNumericOrUnit = (val: string) => {
    const trimmed = val.trim();
    return (
      /^[0-9]+(?:\.[0-9]+)?$/.test(trimmed) ||
      /^[0-9]+(?:\.[0-9]+)?\s*(m²|m³|m\/s|m³\/h|kg\/m³|kJ\/\(kg·K\)|kPa|bar|°C|RPM|%)/i.test(trimmed) ||
      /^[-+]?[0-9,.]+$/.test(trimmed)
    );
  };

  return (
    <div className="chat-table-wrapper">
      <table className="chat-markdown-table">
        <thead>
          <tr>
            {headers.map((h, idx) => (
              <th
                key={idx}
                style={{ textAlign: alignments[idx] || 'left' }}
              >
                {renderInlineContent(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => {
                const numeric = isNumericOrUnit(cell);
                return (
                  <td
                    key={cIdx}
                    className={numeric ? 'numeric-cell' : ''}
                    style={{ textAlign: alignments[cIdx] || 'left' }}
                  >
                    {renderInlineContent(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * FormattedChatMessage component for ChemDiag Industrial AI.
 * Renders mathematical equations (KaTeX), engineering units (JetBrains Mono),
 * tables, code blocks, lists, and conversational text.
 */
export const FormattedChatMessage: React.FC<FormattedChatMessageProps> = ({
  text,
  isAi = true
}) => {
  if (!text) return null;

  // For operator messages: simple paragraph render
  if (!isAi) {
    return (
      <div className="message-body-text">
        {text.split('\n').map((line, idx) => (
          <p key={idx} className="message-paragraph">
            {line}
          </p>
        ))}
      </div>
    );
  }

  // Parse structured blocks for AI messages
  const blocks = parseMessageBlocks(text);

  return (
    <div className="message-body-text">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'math_block':
            return <DisplayMathCard key={idx} math={block.math} />;

          case 'table':
            return (
              <MarkdownTableView
                key={idx}
                headers={block.headers}
                alignments={block.alignments}
                rows={block.rows}
              />
            );

          case 'code':
            return <CodeBlockView key={idx} lang={block.lang} code={block.code} />;

          case 'heading':
            return (
              <div key={idx} className="message-section-heading">
                <span className="message-section-heading-indicator" />
                <span>{renderInlineContent(block.text)}</span>
              </div>
            );

          case 'bullet':
            return (
              <div key={idx} className="message-bullet-line">
                <span className="bullet-symbol">•</span>
                <span>{renderInlineContent(block.text)}</span>
              </div>
            );

          case 'numbered':
            return (
              <div key={idx} className="message-numbered-line">
                <span className="number-badge">{block.num}.</span>
                <span>{renderInlineContent(block.text)}</span>
              </div>
            );

          case 'empty':
            return <div key={idx} style={{ height: '4px' }} />;

          case 'paragraph':
          default:
            return (
              <p key={idx} className="message-paragraph">
                {renderInlineContent(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
};

export default FormattedChatMessage;
