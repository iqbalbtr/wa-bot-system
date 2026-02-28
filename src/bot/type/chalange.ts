export type ChalangeType = {
    slug: string;
    title: string;
    category: string;
    description: string;
    start_date: string;
    due_date: string;
    instruction_url: string;
    challenge_instruction: string;
    submission_url: string;
    message: string;
    default_score: number;
    extra_score_in_days: {
        score: number;
        days_before: number;
    }[];
    max_attempts?: number;
}