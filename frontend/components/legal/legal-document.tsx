function isSectionHeading(line: string) {
  return /^\d+\.\s/.test(line.trim());
}

function isBullet(line: string) {
  return line.trim().startsWith("•");
}

function stripBullet(line: string) {
  return line.trim().replace(/^•\s*/, "");
}

export function LegalDocument({ content }: { content: string }) {
  const paragraphs = content.split(/\n\n+/).filter(Boolean);

  return (
    <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 leading-relaxed">
      {paragraphs.map((block, index) => {
        const lines = block.split("\n").filter((line) => line.trim());
        const firstLine = lines[0] || "";

        if (lines.length === 1 && isSectionHeading(firstLine)) {
          return (
            <h2 key={index} className="font-serif text-xl font-bold text-navy-800 dark:text-white mt-8 mb-3">
              {firstLine}
            </h2>
          );
        }

        if (lines.length === 1 && !isBullet(firstLine) && firstLine.length < 80 && !firstLine.endsWith(".")) {
          return (
            <h2 key={index} className="font-serif text-2xl font-bold text-navy-800 dark:text-white mt-2 mb-4">
              {firstLine}
            </h2>
          );
        }

        if (lines.every(isBullet)) {
          return (
            <ul key={index} className="list-disc pl-6 space-y-2 my-4">
              {lines.map((line, i) => (
                <li key={i}>{stripBullet(line)}</li>
              ))}
            </ul>
          );
        }

        if (lines.some(isBullet)) {
          const heading = lines.find((line) => !isBullet(line) && isSectionHeading(line));
          const bullets = lines.filter(isBullet);
          const prose = lines.filter((line) => !isBullet(line) && line !== heading);
          return (
            <div key={index} className="space-y-3 my-4">
              {heading && (
                <h2 className="font-serif text-xl font-bold text-navy-800 dark:text-white">{heading}</h2>
              )}
              {prose.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
              {bullets.length > 0 && (
                <ul className="list-disc pl-6 space-y-2">
                  {bullets.map((line, i) => (
                    <li key={i}>{stripBullet(line)}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        }

        return (
          <p key={index} className="my-4">
            {block}
          </p>
        );
      })}
    </div>
  );
}
