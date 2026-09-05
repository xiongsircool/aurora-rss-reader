/// CSS injected into bilingual HTML to style translated paragraphs.
const String kBilingualTranslationCss = '''
.aurora-translation {
  color: #6b7280;
  font-style: italic;
  margin-top: 0.25em;
  margin-bottom: 0.75em;
  border-left: 2px solid rgba(59, 130, 246, 0.3);
  padding-left: 8px;
}
@media (prefers-color-scheme: dark) {
  .aurora-translation {
    color: #9ca3af;
    border-left-color: rgba(96, 165, 250, 0.3);
  }
}
''';
