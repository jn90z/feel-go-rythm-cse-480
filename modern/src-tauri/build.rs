fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();

    // Android 15+ devices may use 16 KiB memory pages. Tauri packages a Rust
    // shared library, so force ELF segment alignment that is safe on both
    // 4 KiB and 16 KiB Android devices.
    if target.contains("android") {
        println!("cargo:rustc-link-arg=-Wl,-z,max-page-size=16384");
        println!("cargo:rustc-link-arg=-Wl,-z,common-page-size=16384");
    }

    tauri_build::build()
}
