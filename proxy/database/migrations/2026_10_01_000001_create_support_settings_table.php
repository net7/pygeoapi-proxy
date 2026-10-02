<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $definition = DB::getDriverName() === 'sqlite'
            ? 'id INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
               technical_contact_user_id INTEGER NULL,
               FOREIGN KEY (technical_contact_user_id) REFERENCES users(id) ON DELETE RESTRICT'
            : 'id TINYINT UNSIGNED NOT NULL PRIMARY KEY CHECK (id = 1),
               technical_contact_user_id BIGINT UNSIGNED NULL,
               FOREIGN KEY (technical_contact_user_id) REFERENCES users(id) ON DELETE RESTRICT';

        DB::statement("CREATE TABLE support_settings ({$definition})");
        DB::table('support_settings')->insert(['id' => 1, 'technical_contact_user_id' => null]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('support_settings');
    }
};
