import 'package:aurora_mobile/domain/entities/entry.dart';
import 'package:aurora_mobile/domain/media/audio_source.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'read/star/title/extraction updates preserve audio attachment and language',
    () {
      final audio = Uri.parse('https://example.test/episode.mp3');
      final entry = Entry(
        id: 'entry',
        feedId: 'feed',
        guid: 'episode',
        title: 'Episode',
        insertedAt: DateTime.utc(2026),
        enclosureUrl: audio,
        enclosureType: 'audio/mpeg',
        enclosureDuration: const Duration(minutes: 30),
        sourceLang: 'en',
      );
      final updated = entry
          .markRead(DateTime.utc(2026, 9))
          .copyWith(isStarred: true)
          .copyWith(translatedTitle: '节目')
          .copyWith(readabilityContent: '<p>Show notes</p>')
          .markUnread();
      expect(updated.enclosureUrl, audio);
      expect(updated.enclosureType, 'audio/mpeg');
      expect(updated.enclosureDuration, const Duration(minutes: 30));
      expect(updated.sourceLang, 'en');
    },
  );

  test(
    'normalizes audio MIME and infers extensions only for unknown types',
    () {
      final url = Uri.parse('https://cdn.test/episode.MP3?token=example');
      expect(isAudioAttachment(url, 'Audio/MPEG; charset=utf-8'), isTrue);
      expect(isAudioAttachment(url, 'application/octet-stream'), isTrue);
      expect(isAudioAttachment(url, null), isTrue);
      expect(isAudioAttachment(url, 'image/jpeg'), isFalse);
      expect(
        isAudioAttachment(Uri.parse('https://example.test/watch'), null),
        isFalse,
      );
    },
  );

  test('blog audio supports audio/source and relative URLs', () {
    expect(
      findArticleAudio(
        baseUrl: Uri.parse('https://example.test/posts/read'),
        html: '<audio controls><source src="../episode.m4a" type="audio/mp4"></audio>',
      ),
      Uri.parse('https://example.test/episode.m4a'),
    );
    expect(
      findArticleAudio(html: '<audio src="https://cdn.test/play/123"></audio>'),
      Uri.parse('https://cdn.test/play/123'),
    );
    expect(
      findArticleAudio(html: '<audio src="file:///secret"></audio>'),
      isNull,
    );
    expect(findArticleAudio(html: '<p>No audio</p>'), isNull);
  });
}
