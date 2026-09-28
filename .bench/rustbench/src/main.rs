use comrak::{Arena, Options, parse_document, format_commonmark};
use std::time::Instant;

fn main() {
    let src = std::fs::read_to_string("../fixture.md").expect("fixture.md");
    let n = 7;
    let (mut bp, mut bf) = (f64::MAX, f64::MAX);
    let mut bytes = 0usize;
    for _ in 0..n {
        let arena = Arena::new();
        let opts = Options::default();
        let t = Instant::now();
        let root = parse_document(&arena, &src, &opts);
        let p = t.elapsed().as_secs_f64() * 1000.0;
        let t2 = Instant::now();
        let mut out = String::new();
        let _ = format_commonmark(root, &opts, &mut out);
        let f = t2.elapsed().as_secs_f64() * 1000.0;
        bytes = out.len();
        if p < bp { bp = p; }
        if f < bf { bf = f; }
    }
    println!("RUST comrak: parse {:.1} ms, format {:.1} ms, out {} bytes (input {} bytes)", bp, bf, bytes, src.len());
}
