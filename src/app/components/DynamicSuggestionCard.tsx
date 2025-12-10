"use client";
type Suggestion = {
  id: string;
  title: string;
};

export default function DynamicSuggestionCard({
  suggestions,
  onSend
}: {
  suggestions: Suggestion[];
  onSend: (t: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto py-2">
      {suggestions.map((s) => (
        <button
          key={s.id}
          onClick={() => onSend(s.title)}
          className="px-4 py-2 bg-gray-800 text-white rounded-full whitespace-nowrap"
        >
          {s.title}
        </button>
      ))}
    </div>
  );
}
