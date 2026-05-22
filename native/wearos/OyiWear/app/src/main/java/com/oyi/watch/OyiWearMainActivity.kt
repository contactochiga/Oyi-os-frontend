package com.oyi.watch

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

class OyiWearMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { OyiWearApp() }
    }
}

enum class OyiWearState { Awareness, Listening, Thinking, Executing, ConfirmationRequired, Success, Alert, Failed }

data class WatchAction(val id: String, val label: String, val prompt: String, val risk: String, val enabled: Boolean = true)
data class WatchGlance(val id: String, val title: String, val detail: String, val state: String)

class OyiWearSession {
    var baseUrl: String? = null
    var bearerToken: String? = null

    suspend fun homeStatus(): WatchGlance = WatchGlance("home", "Home calm", "All systems normal", "calm")
    suspend fun glances(): List<WatchGlance> = listOf(
        WatchGlance("home", "Home calm", "All systems normal", "calm"),
        WatchGlance("visitor", "Visitor at gate", "Front Gate", "alert"),
        WatchGlance("climate", "Living room", "24° · Cool", "aware")
    )
    suspend fun actions(): List<WatchAction> = listOf(
        WatchAction("show_status", "Home status", "show home status", "read"),
        WatchAction("all_lights_off", "All lights off", "turn off lights", "low"),
        WatchAction("movie_mode", "Movie mode", "activate movie mode", "low"),
        WatchAction("arm_security", "Arm security", "arm security", "medium")
    )

    // Production implementation should call:
    // GET /watch/home-status, GET /watch/glances, GET /watch/quick-actions,
    // POST /watch/command, POST /watch/confirm, POST /watch/cancel
    // with the same bearer token issued to Oyi Home.
}

@Composable
fun OyiWearApp(session: OyiWearSession = remember { OyiWearSession() }) {
    var state by remember { mutableStateOf(OyiWearState.Awareness) }
    var title by remember { mutableStateOf("Home calm") }
    var detail by remember { mutableStateOf("All systems normal") }
    var actions by remember { mutableStateOf<List<WatchAction>>(emptyList()) }

    LaunchedEffect(Unit) {
        val status = session.homeStatus()
        title = status.title
        detail = status.detail
        actions = session.actions()
    }

    MaterialTheme(colorScheme = darkColorScheme(background = Color.Black, surface = Color(0xFF050A12))) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Brush.radialGradient(listOf(Color(0x332A7BFF), Color.Black)))
                .padding(10.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                OyiOrb(state)
                Spacer(Modifier.height(8.dp))
                Text(title, color = Color.White, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
                Text(detail, color = Color.White.copy(alpha = 0.55f), style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
                Spacer(Modifier.height(10.dp))
                LazyVerticalGrid(columns = GridCells.Fixed(2), modifier = Modifier.heightIn(max = 116.dp), contentPadding = PaddingValues(0.dp)) {
                    items(actions) { action ->
                        Button(
                            onClick = {
                                state = if (action.risk == "medium") OyiWearState.ConfirmationRequired else OyiWearState.Executing
                                title = if (state == OyiWearState.ConfirmationRequired) "Confirm?" else "Working"
                                detail = action.label
                            },
                            enabled = action.enabled,
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.padding(3.dp)
                        ) { Text(action.label, style = MaterialTheme.typography.labelSmall) }
                    }
                }
            }
        }
    }
}

@Composable
fun OyiOrb(state: OyiWearState) {
    val color = when (state) {
        OyiWearState.Success -> Color(0xFF33E38D)
        OyiWearState.Alert, OyiWearState.Failed -> Color(0xFFFF4B57)
        OyiWearState.ConfirmationRequired -> Color(0xFFFFB454)
        OyiWearState.Executing, OyiWearState.Thinking -> Color(0xFF2A7BFF)
        else -> Color(0xFF37C9FF)
    }
    Box(
        modifier = Modifier
            .size(86.dp)
            .clip(CircleShape)
            .background(Brush.radialGradient(listOf(color.copy(alpha = 0.95f), Color.Black)))
    )
}
