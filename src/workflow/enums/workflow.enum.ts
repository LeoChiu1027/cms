export enum EntityType {
    CONTENT = 'content',
}

export enum WorkflowStatus {
    DRAFT = 'draft',
    PENDING_REVIEW = 'pending_review',
    IN_REVIEW = 'in_review',
    CHANGES_REQUESTED = 'changes_requested',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

export enum WorkflowOperation {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
}

export enum ApprovalAction {
    APPROVE = 'approve',
    REJECT = 'reject',
    REQUEST_CHANGES = 'request_changes',
    COMMENT = 'comment',
}
