import 'package:aurora_mobile/domain/entities/entry.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('entry read state is represented by readAt', () {
    final entry = Entry(
      id: 'entry-1',
      feedId: 'feed-1',
      guid: 'guid-1',
      title: 'Local-first RSS',
      insertedAt: DateTime.utc(2026, 9, 2),
    );

    expect(entry.isRead, isFalse);

    final readAt = DateTime.utc(2026, 9, 2, 10);
    final readEntry = entry.markRead(readAt);
    expect(readEntry.isRead, isTrue);
    expect(readEntry.readAt, readAt);
    expect(entry.isRead, isFalse);

    final unreadEntry = readEntry.markUnread();
    expect(unreadEntry.isRead, isFalse);
    expect(unreadEntry.readAt, isNull);
  });
}
