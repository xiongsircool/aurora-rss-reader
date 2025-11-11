from app.utils.text import clean_html_text


def test_clean_html_text_none():
    assert clean_html_text(None) is None
    assert clean_html_text("") is None


def test_clean_html_text_basic_tags():
    html_value = '<p>Hello <strong>World</strong>!</p>'
    assert clean_html_text(html_value) == "Hello World!"


def test_clean_html_text_complex_snippet():
    html_value = (
        '<p>Nature Methods, Published online: 10 November 2025; '
        '<a href="https://www.nature.com/articles/s41592-025-02884-z">'
        'doi:10.1038/s41592-025-02884-z</a></p>'
        "<p>The reactive&nbsp;oxygen species<br/>cause issues.</p>"
    )
    expected = (
        "Nature Methods, Published online: 10 November 2025; "
        "doi:10.1038/s41592-025-02884-z "
        "The reactive oxygen species cause issues."
    )
    assert clean_html_text(html_value) == expected


def test_clean_html_text_only_entities():
    assert clean_html_text("&nbsp;&nbsp;") is None
