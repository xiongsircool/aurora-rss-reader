use dashmap::DashMap;
use lru::LruCache;
use std::num::NonZeroUsize;

#[allow(dead_code)]
pub struct MemoryCache<K, V> {
    cache: LruCache<K, V>,
}

impl<K, V> MemoryCache<K, V>
where
    K: std::hash::Hash + Eq + Clone,
    V: Clone,
{
    #[allow(dead_code)]
    pub fn new(capacity: usize) -> Self {
        let capacity = NonZeroUsize::new(capacity.max(1)).unwrap();
        Self {
            cache: LruCache::new(capacity),
        }
    }

    #[allow(dead_code)]
    pub fn get(&mut self, key: &K) -> Option<V> {
        self.cache.get(key).cloned()
    }

    #[allow(dead_code)]
    pub fn put(&mut self, key: K, value: V) {
        self.cache.put(key, value);
    }

    #[allow(dead_code)]
    pub fn contains(&mut self, key: &K) -> bool {
        self.cache.contains(key)
    }
}

// Thread-safe cache using DashMap
#[allow(dead_code)]
pub struct SharedCache<K, V> {
    cache: DashMap<K, V>,
}

impl<K, V> Default for SharedCache<K, V>
where
    K: std::hash::Hash + Eq + Clone + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    fn default() -> Self {
        Self::new()
    }
}

impl<K, V> SharedCache<K, V>
where
    K: std::hash::Hash + Eq + Clone + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            cache: DashMap::new(),
        }
    }

    #[allow(dead_code)]
    pub fn get(&self, key: &K) -> Option<V> {
        self.cache.get(key).map(|entry| entry.clone())
    }

    #[allow(dead_code)]
    pub fn put(&self, key: K, value: V) {
        self.cache.insert(key, value);
    }

    #[allow(dead_code)]
    pub fn remove(&self, key: &K) -> Option<V> {
        self.cache.remove(key).map(|(_, v)| v)
    }

    #[allow(dead_code)]
    pub fn clear(&self) {
        self.cache.clear()
    }
}
