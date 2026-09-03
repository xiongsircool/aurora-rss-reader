/// Lenient feed date parsing across RFC 822 (RSS), ISO 8601 (Atom),
/// and Unix timestamps emitted by some generators.
DateTime? parseFeedDate(String? raw) {
  if (raw == null) return null;
  final text = raw.trim();
  if (text.isEmpty) return null;

  final unix = _tryUnixTimestamp(text);
  if (unix != null) return unix;

  return _tryIso8601(text) ?? _tryRfc822(text);
}

final _unixSeconds = RegExp(r'^\d{9,12}$');
final _unixMillis = RegExp(r'^\d{13,15}$');

DateTime? _tryUnixTimestamp(String text) {
  if (_unixSeconds.hasMatch(text)) {
    return DateTime.fromMillisecondsSinceEpoch(
      int.parse(text) * 1000,
      isUtc: true,
    );
  }
  if (_unixMillis.hasMatch(text)) {
    return DateTime.fromMillisecondsSinceEpoch(int.parse(text), isUtc: true);
  }
  return null;
}

DateTime? _tryIso8601(String text) {
  final normalized = text.replaceFirst(' ', 'T');
  final parsed = DateTime.tryParse(normalized);
  if (parsed == null) return null;

  final hasExplicitZone = RegExp(
    r'(?:Z|[+-]\d{2}:?\d{2})$',
    caseSensitive: false,
  ).hasMatch(normalized);
  if (hasExplicitZone) return parsed.toUtc();

  // A date without a zone is treated as UTC so results remain deterministic
  // across devices in different local time zones.
  return DateTime.utc(
    parsed.year,
    parsed.month,
    parsed.day,
    parsed.hour,
    parsed.minute,
    parsed.second,
    parsed.millisecond,
    parsed.microsecond,
  );
}

final _rfc822 = RegExp(
  r'^(?:\w{3},\s*)?(\d{1,2})\s+(\w{3})\s+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4}|[A-Z]{1,5})?$',
);

const _months = {
  'JAN': 1,
  'FEB': 2,
  'MAR': 3,
  'APR': 4,
  'MAY': 5,
  'JUN': 6,
  'JUL': 7,
  'AUG': 8,
  'SEP': 9,
  'OCT': 10,
  'NOV': 11,
  'DEC': 12,
};

DateTime? _tryRfc822(String text) {
  final match = _rfc822.firstMatch(text.trim().toUpperCase());
  if (match == null) return null;

  final day = int.parse(match.group(1)!);
  final month = _months[match.group(2)!];
  if (month == null) return null;

  var year = int.parse(match.group(3)!);
  if (year < 100) year += 2000;

  final hour = int.parse(match.group(4)!);
  final minute = int.parse(match.group(5)!);
  final second = int.tryParse(match.group(6) ?? '0') ?? 0;

  var utc = DateTime.utc(year, month, day, hour, minute, second);

  final zone = match.group(7);
  if (zone != null && zone != 'Z' && zone != 'GMT' && zone != 'UTC') {
    final offset = _zoneOffset(zone);
    if (offset != null) {
      utc = utc.subtract(offset);
    }
  }
  return utc;
}

Duration? _zoneOffset(String zone) {
  final signed = RegExp(r'^([+-])(\d{2})(\d{2})$').firstMatch(zone);
  if (signed == null) {
    // Named military zones: treat only common ones, ignore the rest.
    switch (zone) {
      case 'EST':
        return const Duration(hours: 5);
      case 'EDT':
        return const Duration(hours: 4);
      case 'CST':
        return const Duration(hours: 6);
      case 'CDT':
        return const Duration(hours: 5);
      case 'PST':
        return const Duration(hours: 8);
      case 'PDT':
        return const Duration(hours: 7);
      default:
        return null;
    }
  }
  final sign = signed.group(1) == '-' ? -1 : 1;
  final hours = int.parse(signed.group(2)!);
  final minutes = int.parse(signed.group(3)!);
  return Duration(hours: sign * hours, minutes: sign * minutes);
}
