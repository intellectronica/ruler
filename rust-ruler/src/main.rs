use ruler::run;

fn main() {
    if let Err(e) = run() {
        eprintln!("{} {}", ruler::ERROR_PREFIX, e);
        std::process::exit(1);
    }
}
