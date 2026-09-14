import type {
  DashboardSummary,
  DashboardCounts,
  RecentActivityItem,
  AttentionItem,
} from '@visaflow/shared-types';

export class DashboardResponseDto implements DashboardSummary {
  counts!: DashboardCounts;
  recentActivity!: RecentActivityItem[];
  attentionItems!: AttentionItem[];
}
