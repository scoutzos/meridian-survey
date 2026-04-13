import { oaSurvey } from "./questions";
import { readinessSurvey } from "./readiness-survey";

export interface SurveyQuestion {
  id: string;
  text: string;
  options?: string[];
  priority: "critical" | "important" | "recommended";
}

export interface SurveyCategory {
  id: string;
  name: string;
  questions: SurveyQuestion[];
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  categories: SurveyCategory[];
}

const surveys: Survey[] = [oaSurvey, readinessSurvey];

export function getAllSurveys(): Survey[] {
  return surveys;
}

export function getSurveyById(id: string): Survey | undefined {
  return surveys.find(s => s.id === id);
}
