import { oaSurvey } from "./questions";
import { readinessSurvey } from "./readiness-survey";
import { brandingSurvey } from "./branding-survey";

export interface SurveyQuestion {
  id: string;
  text: string;
  context?: string;
  options?: string[];
  placeholder?: string;
  inputType?: "currency" | "text";
  singleSelect?: boolean;
  /** Display another question's answer inline in the question text. Use {value} in the text to place it. */
  referenceQuestionId?: string;
  priority: "critical" | "important" | "recommended";
  /** Show this question only if the referenced question's answer includes the given value */
  showIf?: { questionId: string; includes: string };
}

export interface SurveyCategory {
  id: string;
  name: string;
  description?: string;
  questions: SurveyQuestion[];
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  categories: SurveyCategory[];
}

const surveys: Survey[] = [oaSurvey, readinessSurvey, brandingSurvey];

export function getAllSurveys(): Survey[] {
  return surveys;
}

export function getSurveyById(id: string): Survey | undefined {
  return surveys.find(s => s.id === id);
}
