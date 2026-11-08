"""
tests/test_scene_composer.py
Unit tests untuk Scene Composer – mesin render terpadu AUTOFEEDS.
Menguji semua 6 resep, quality gate, preview, dan document.json.
"""
import unittest
import json
import shutil
import tempfile
from pathlib import Path
import sys

# Tambahkan scripts/ ke sys.path
SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from scene_composer import (
    compose_poster,
    quality_gate_audit,
    RECIPES,
    FORMATS,
)
from PIL import Image


# ─── Cari foto produk untuk pengujian ────────────────────────────────────────

def find_test_image() -> str | None:
    """Cari foto upload pertama yang tersedia."""
    root = Path(__file__).resolve().parent.parent
    for pat in ["storage/uploads/promo/*.jpg", "storage/uploads/**/*.jpg"]:
        found = list(root.glob(pat))
        if found:
            return str(found[0])
    return None


TEST_IMAGE = find_test_image()
REQUIRE_IMAGE = unittest.skipUnless(TEST_IMAGE, "Tidak ada foto produk uji (storage/uploads/promo/*.jpg)")


class TestSceneComposerRecipes(unittest.TestCase):
    """Semua 6 resep harus merender tanpa error di format feed."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="sc_test_")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _base_spec(self, recipe: str) -> dict:
        spec = {
            "headline": "GURIH RENYAH SPESIAL",
            "tagline": "Keluarga Suka!",
            "format": "feed",
            "recipe": recipe,
            "mood": "warm",
            "benefits": ["Halal Terjamin", "Tanpa MSG", "Rasa Autentik"],
            "price_text": "Rp 25.000",
            "old_price": "Rp 35.000",
            "goal": "diskon",
        }
        if TEST_IMAGE:
            spec["product_image"] = TEST_IMAGE
        return spec

    @REQUIRE_IMAGE
    def test_hero_left_target(self):
        self._run_recipe("hero_left_target")

    @REQUIRE_IMAGE
    def test_hero_center_burst(self):
        self._run_recipe("hero_center_burst")

    @REQUIRE_IMAGE
    def test_split_diagonal(self):
        self._run_recipe("split_diagonal")

    @REQUIRE_IMAGE
    def test_flatlay_overhead(self):
        self._run_recipe("flatlay_overhead")

    @REQUIRE_IMAGE
    def test_price_star(self):
        self._run_recipe("price_star")

    @REQUIRE_IMAGE
    def test_minimal_luxury(self):
        self._run_recipe("minimal_luxury")

    def _run_recipe(self, recipe_id: str):
        out_path = Path(self.tmp) / f"{recipe_id}.jpg"
        spec = self._base_spec(recipe_id)
        result = compose_poster(spec, str(out_path))
        self.assertTrue(out_path.exists(), f"Output tidak ada untuk resep {recipe_id}")
        self.assertTrue(result.get("success"), f"success=False untuk {recipe_id}: {result}")
        self.assertEqual(result.get("recipe"), recipe_id)
        # Pastikan file gambar valid
        with Image.open(out_path) as img:
            self.assertGreater(img.width, 0)
            self.assertGreater(img.height, 0)


class TestSceneComposerFormats(unittest.TestCase):
    """Setiap format output menghasilkan dimensi yang benar."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="sc_fmt_")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    @REQUIRE_IMAGE
    def test_feed_dimensions(self):
        self._check_format("feed", 1080, 1350)

    @REQUIRE_IMAGE
    def test_square_dimensions(self):
        self._check_format("square", 1080, 1080)

    @REQUIRE_IMAGE
    def test_story_dimensions(self):
        self._check_format("story", 1080, 1920)

    def _check_format(self, fmt: str, expected_w: int, expected_h: int):
        out = Path(self.tmp) / f"fmt_{fmt}.jpg"
        spec = {"headline": "TEST", "format": fmt, "recipe": "hero_left_target"}
        if TEST_IMAGE:
            spec["product_image"] = TEST_IMAGE
        result = compose_poster(spec, str(out))
        self.assertEqual(result.get("width"), expected_w, f"Lebar salah untuk format {fmt}")
        self.assertEqual(result.get("height"), expected_h, f"Tinggi salah untuk format {fmt}")


class TestSceneComposerQualityGate(unittest.TestCase):
    """Quality gate harus mengembalikan skor antara 0–100."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="sc_qg_")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    @REQUIRE_IMAGE
    def test_quality_score_range(self):
        out = Path(self.tmp) / "qg_test.jpg"
        spec = {
            "product_image": TEST_IMAGE,
            "headline": "KUALITAS TERBAIK",
            "format": "feed",
            "recipe": "hero_left_target",
            "benefits": ["Halal", "Sehat", "Enak"],
        }
        result = compose_poster(spec, str(out))
        score = result.get("quality_score", -1)
        self.assertGreaterEqual(score, 0, "Skor kurang dari 0")
        self.assertLessEqual(score, 100, "Skor lebih dari 100")
        # Result harus mengandung field quality_passed
        self.assertIn("quality_passed", result)

    @REQUIRE_IMAGE
    def test_quality_gate_audit_direct(self):
        """quality_gate_audit() langsung harus mengembalikan (bool, int, list)."""
        from PIL import Image as PILImage
        canvas = PILImage.new("RGBA", (1080, 1350), (220, 38, 38, 255))
        spec = {"product_image": TEST_IMAGE, "headline": "TEST"}
        passed, score, issues = quality_gate_audit(canvas, spec)
        self.assertIsInstance(passed, bool)
        self.assertIsInstance(score, (int, float))
        self.assertIsInstance(issues, list)


class TestSceneComposerPreview(unittest.TestCase):
    """Preview thumbnail harus ada dan berukuran lebih kecil dari output penuh."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="sc_prev_")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    @REQUIRE_IMAGE
    def test_preview_generated(self):
        out = Path(self.tmp) / "full.jpg"
        prev = Path(self.tmp) / "preview.jpg"
        spec = {"product_image": TEST_IMAGE, "headline": "PREVIEW TEST", "format": "feed"}
        compose_poster(spec, str(out), preview_path=str(prev))
        self.assertTrue(prev.exists(), "File preview tidak ada")
        full_img = Image.open(out)
        prev_img = Image.open(prev)
        # Preview harus lebih kecil dari atau sama dengan output penuh
        self.assertLessEqual(prev_img.width, full_img.width)
        self.assertLessEqual(prev_img.height, full_img.height)


class TestSceneComposerDocumentJson(unittest.TestCase):
    """document.json harus valid JSON dengan field layers dan version."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="sc_doc_")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    @REQUIRE_IMAGE
    def test_document_json_structure(self):
        out = Path(self.tmp) / "doc_test.jpg"
        doc = Path(self.tmp) / "document.json"
        spec = {
            "product_image": TEST_IMAGE,
            "headline": "DOC TEST",
            "format": "feed",
            "recipe": "hero_left_target",
        }
        compose_poster(spec, str(out), doc_path=str(doc))
        if doc.exists():
            data = json.loads(doc.read_text(encoding="utf-8"))
            self.assertIn("version", data, "document.json tidak mengandung 'version'")
            self.assertIn("layers", data, "document.json tidak mengandung 'layers'")
            self.assertIn("width", data)
            self.assertIn("height", data)


class TestSceneComposerNoImage(unittest.TestCase):
    """Scene Composer harus tetap jalan meski tanpa foto produk (fallback latar saja)."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="sc_noi_")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_render_without_product_image(self):
        out = Path(self.tmp) / "no_image.jpg"
        spec = {
            "headline": "TANPA FOTO",
            "tagline": "Tetap Jalan",
            "format": "feed",
            "recipe": "minimal_luxury",
        }
        # Tidak boleh throw – fallback ke placeholder
        result = compose_poster(spec, str(out))
        self.assertTrue(out.exists(), "Output harus tetap ada meski tanpa foto produk")
        self.assertTrue(result.get("success"))


class TestSceneComposerRecipeRegistry(unittest.TestCase):
    """RECIPES dict harus mengandung semua 6 resep yang diharapkan."""

    def test_all_recipes_registered(self):
        expected = {
            "hero_left_target",
            "hero_center_burst",
            "split_diagonal",
            "flatlay_overhead",
            "price_star",
            "minimal_luxury",
        }
        self.assertEqual(set(RECIPES.keys()), expected)

    def test_formats_registered(self):
        for fmt in ("feed", "story", "square"):
            self.assertIn(fmt, FORMATS)


if __name__ == "__main__":
    unittest.main()
