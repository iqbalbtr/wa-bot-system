export type ChalangeType = {
    slug: string;
    title: string;
    description: string;
    order: 'asc' | 'desc';
    due_date: string;
    instruction_url: string;
    message: string;
    min_score?: number;
    max_score?: number;
    max_attempts?: number;
}