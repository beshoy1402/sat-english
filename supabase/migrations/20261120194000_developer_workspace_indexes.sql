create index if not exists developer_tasks_created_by_idx on public.developer_tasks(created_by);
create index if not exists developer_task_comments_author_idx on public.developer_task_comments(author_profile_id);
create index if not exists developer_task_attachments_uploaded_by_idx on public.developer_task_attachments(uploaded_by);
create index if not exists developer_task_attachments_task_idx on public.developer_task_attachments(task_id);
create index if not exists developer_bug_reports_reported_by_idx on public.developer_bug_reports(reported_by);
create index if not exists developer_bug_reports_assigned_to_idx on public.developer_bug_reports(assigned_to);
create index if not exists developer_pull_requests_submitted_by_idx on public.developer_pull_requests(submitted_by);
create index if not exists developer_pull_requests_reviewer_idx on public.developer_pull_requests(reviewer_profile_id);