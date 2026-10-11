import { Global, Injectable, Module } from '@nestjs/common';
import { BoardEvent } from '@teamflow/shared';
import { Observable, Subject } from 'rxjs';

/** A board event plus the tenant it belongs to (never sent to clients as-is). */
export interface DomainEvent {
  workspaceId: string;
  event: BoardEvent;
}

/**
 * In-process event bus (observer pattern) built on an RxJS Subject.
 *
 * WHY: tasks/comments should not know who reacts to their changes (activity log,
 * real-time gateway, email notifications). They publish; listeners subscribe.
 * Adding a listener never touches the publishing code.
 *
 * Publish only AFTER the database write succeeded, so listeners never see changes
 * that were rolled back. Errors thrown by a listener are reported by RxJS
 * asynchronously and do not fail the HTTP request that published the event.
 */
@Injectable()
export class DomainEvents {
  private readonly subject = new Subject<DomainEvent>();
  readonly events$: Observable<DomainEvent> = this.subject.asObservable();

  publish(event: DomainEvent): void {
    this.subject.next(event);
  }
}

@Global()
@Module({
  providers: [DomainEvents],
  exports: [DomainEvents],
})
export class DomainEventsModule {}
