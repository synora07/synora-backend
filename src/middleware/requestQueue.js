// ============================================
// SYNORA - Request Queue
// Verhindert Claude API Überlastung
// ============================================

class RequestQueue {
  constructor(options = {}) {
    this.queue = [];
    this.processing = 0;
    this.maxConcurrent = options.maxConcurrent || 5;  // Max 5 gleichzeitige Claude Anfragen
    this.maxQueueSize = options.maxQueueSize || 100;  // Max 100 wartende Anfragen
    this.timeout = options.timeout || 30000;          // 30 Sekunden Timeout
    
    console.log(`[QUEUE] Request Queue initialized (max ${this.maxConcurrent} concurrent)`);
  }
  
  // ============================================
  // ADD - Anfrage zur Queue hinzufügen
  // ============================================
  async add(asyncFunction) {
    return new Promise((resolve, reject) => {
      // Queue voll?
      if (this.queue.length >= this.maxQueueSize) {
        console.log('[QUEUE] Queue full - rejecting request');
        return reject(new Error('Server überlastet. Bitte versuche es später.'));
      }
      
      const task = {
        fn: asyncFunction,
        resolve,
        reject,
        addedAt: Date.now()
      };
      
      this.queue.push(task);
      console.log(`[QUEUE] Task added. Queue size: ${this.queue.length}, Processing: ${this.processing}`);
      
      this.processNext();
    });
  }
  
  // ============================================
  // PROCESS NEXT - Nächste Anfrage verarbeiten
  // ============================================
  async processNext() {
    // Bereits genug parallel?
    if (this.processing >= this.maxConcurrent) {
      return;
    }
    
    // Queue leer?
    if (this.queue.length === 0) {
      return;
    }
    
    // Älteste Aufgabe holen
    const task = this.queue.shift();
    
    // Timeout prüfen (wurde zu lange gewartet?)
    if (Date.now() - task.addedAt > this.timeout) {
      console.log('[QUEUE] Task timed out in queue');
      task.reject(new Error('Anfrage-Timeout. Bitte versuche es erneut.'));
      this.processNext();
      return;
    }
    
    this.processing++;
    
    try {
      const result = await Promise.race([
        task.fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), this.timeout)
        )
      ]);
      
      task.resolve(result);
    } catch (error) {
      console.log('[QUEUE] Task error:', error.message);
      task.reject(error);
    } finally {
      this.processing--;
      this.processNext();
    }
  }
  
  // ============================================
  // STATS
  // ============================================
  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      maxConcurrent: this.maxConcurrent
    };
  }
  
  // ============================================
  // CLEAR - Queue leeren
  // ============================================
  clear() {
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      task.reject(new Error('Queue cleared'));
    }
    console.log('[QUEUE] Queue cleared');
  }
}

// ============================================
// CLAUDE API QUEUE - Singleton
// ============================================
const claudeQueue = new RequestQueue({
  maxConcurrent: 5,    // 5 parallele Claude Anfragen
  maxQueueSize: 200,   // 200 wartende Anfragen (für 200 User)
  timeout: 45000       // 45 Sekunden Timeout
});

module.exports = {
  RequestQueue,
  claudeQueue
};